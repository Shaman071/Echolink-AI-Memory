import os
import json
import logging
import hashlib
from pathlib import Path
import threading

from flask import Flask, request, jsonify
from flask_cors import CORS
from sentence_transformers import SentenceTransformer
import numpy as np
import faiss

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Read configuration from environment variables (with sensible defaults)
MODEL_NAME = os.getenv("MODEL_NAME", "sentence-transformers/all-MiniLM-L6-v2")
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "5000"))
HF_CACHE_DIR = os.getenv("HF_CACHE_DIR", "./hf_cache")
VECTOR_STORE_DIR = Path(os.getenv("VECTOR_STORE_DIR", "./vectorstore"))
INDEX_PATH = VECTOR_STORE_DIR / "index.faiss"
METADATA_PATH = VECTOR_STORE_DIR / "metadata.json"

logger.info(f"Config -> MODEL_NAME: {MODEL_NAME}, HOST: {HOST}, PORT: {PORT}, HF_CACHE_DIR: {HF_CACHE_DIR}")

app = Flask(__name__)
CORS(app)

# Load the model with cache folder (wrapped in try so errors are logged clearly)
try:
    logger.info(f"Loading model '{MODEL_NAME}' (cache: {HF_CACHE_DIR})...")
    model = SentenceTransformer(MODEL_NAME, cache_folder=HF_CACHE_DIR)
    embedding_dim = model.get_sentence_embedding_dimension()
    logger.info(f"Model loaded successfully. Embedding dimension: {embedding_dim}")
except Exception as e:
    logger.exception("Failed to load model at startup. The server will still run but /embed endpoints will return 500.")
    model = None
    embedding_dim = None

store_lock = threading.Lock()
vector_metadata = {}
faiss_id_lookup = {}
faiss_index = None

def _ensure_vector_dir():
    VECTOR_STORE_DIR.mkdir(parents=True, exist_ok=True)


def _doc_id_to_faiss_id(doc_id: str) -> int:
    # Use stable hash (first 15 hex chars of SHA256) to fit inside signed 64-bit
    digest = hashlib.sha256(doc_id.encode("utf-8")).hexdigest()[:15]
    return int(digest, 16)


def _normalize_vector(vec: np.ndarray) -> np.ndarray:
    if not isinstance(vec, np.ndarray):
        vec = np.array(vec, dtype=np.float32)
    vec = vec.astype(np.float32)
    norm = np.linalg.norm(vec)
    if norm == 0:
        return vec
    return vec / norm


def _init_faiss_index():
    global faiss_index, embedding_dim
    if embedding_dim is None:
        raise RuntimeError("Embedding dimension unknown; cannot initialize FAISS index")
    base_index = faiss.IndexFlatIP(embedding_dim)
    faiss_index = faiss.IndexIDMap(base_index)


def _rebuild_index_from_metadata():
    """Recreate FAISS index from stored metadata using the local model."""
    global faiss_index
    if model is None:
        logger.warning("Cannot rebuild FAISS index because the model failed to load.")
        return
    if faiss_index is None:
        _init_faiss_index()
    faiss_index.reset()
    embeddings = []
    ids = []
    for doc_id, payload in vector_metadata.items():
        text = payload.get("text")
        if not text:
            continue
        try:
            emb = model.encode(text, convert_to_numpy=True)
            emb = _normalize_vector(emb)
        except Exception as err:
            logger.warning("Failed to rebuild embedding for %s: %s", doc_id, err)
            continue
        embeddings.append(emb)
        ids.append(payload.get("faiss_id", _doc_id_to_faiss_id(doc_id)))
    if embeddings:
        stacked = np.stack(embeddings).astype(np.float32)
        id_array = np.array(ids, dtype="int64")
        faiss_index.add_with_ids(stacked, id_array)


def load_vector_store():
    global vector_metadata, faiss_id_lookup, faiss_index, embedding_dim
    _ensure_vector_dir()

    if METADATA_PATH.exists():
        try:
            with METADATA_PATH.open("r", encoding="utf-8") as fh:
                data = json.load(fh)
                if isinstance(data, dict):
                    vector_metadata = data
                else:
                    vector_metadata = {}
        except Exception:
            logger.exception("Failed to load metadata; starting with empty store")
            vector_metadata = {}
    else:
        vector_metadata = {}

    faiss_id_lookup = {}
    metadata_dirty = False
    for doc_id, payload in vector_metadata.items():
        faiss_id = payload.get("faiss_id")
        if faiss_id is None:
            faiss_id = _doc_id_to_faiss_id(doc_id)
            payload["faiss_id"] = faiss_id
            metadata_dirty = True
        faiss_id_lookup[faiss_id] = doc_id

    if INDEX_PATH.exists():
        try:
            faiss_index_loaded = faiss.read_index(str(INDEX_PATH))
            faiss_index = faiss_index_loaded
            if embedding_dim is None:
                embedding_dim = faiss_index.d
            logger.info("Loaded FAISS index with %s vectors", faiss_index.ntotal)
        except Exception:
            logger.exception("Failed to load FAISS index; it will be rebuilt from metadata if possible")
            faiss_index = None

    if faiss_index is None:
        if embedding_dim is None and model is not None:
            embedding_dim = model.get_sentence_embedding_dimension()
        if embedding_dim is not None:
            _init_faiss_index()
            if vector_metadata:
                _rebuild_index_from_metadata()
        else:
            logger.warning("Embedding dimension still unknown; FAISS index will initialize after model loads")

    if metadata_dirty:
        save_vector_store()


load_vector_store()


def save_vector_store():
    _ensure_vector_dir()
    try:
        if faiss_index is not None:
            faiss.write_index(faiss_index, str(INDEX_PATH))
        with METADATA_PATH.open("w", encoding="utf-8") as fh:
            json.dump(vector_metadata, fh, ensure_ascii=False, indent=2)
    except Exception:
        logger.exception("Failed to persist vector store to disk")


def upsert_document(doc_id: str, text: str, meta: dict, embedding_vector):
    global faiss_index
    if embedding_dim is None:
        # Derive embedding dimension from provided vector
        embedding_dim_from_vec = len(embedding_vector)
        if embedding_dim_from_vec <= 0:
            raise ValueError("Invalid embedding vector supplied")
        embedding_dim_placeholder = embedding_dim_from_vec
    else:
        embedding_dim_placeholder = embedding_dim

    if faiss_index is None:
        if embedding_dim is None:
            # update global dim and init
            globals()['embedding_dim'] = embedding_dim_placeholder
        _init_faiss_index()

    vector = _normalize_vector(embedding_vector).reshape(1, -1).astype(np.float32)
    faiss_id = _doc_id_to_faiss_id(doc_id)
    with store_lock:
        # Remove previous vector if present
        try:
            faiss_index.remove_ids(np.array([faiss_id], dtype='int64'))
        except Exception:
            # remove_ids raises if the id doesn't exist; safe to ignore
            pass

        faiss_index.add_with_ids(vector, np.array([faiss_id], dtype='int64'))
        vector_metadata[doc_id] = {
            "text": text,
            "meta": meta or {},
            "faiss_id": faiss_id,
        }
        faiss_id_lookup[faiss_id] = doc_id


def current_index_size() -> int:
    if faiss_index is None:
        return 0
    return faiss_index.ntotal


@app.route("/health", methods=["GET"])
def health():
    """Health / readiness endpoint"""
    return jsonify({
        "status": "ok" if model is not None else "model_not_loaded",
        "model": MODEL_NAME,
        "embedding_dim": embedding_dim,
        "indexed_count": current_index_size()
    }), 200

@app.route("/status", methods=["GET"])
def status():
    """Status endpoint with indexing information"""
    return jsonify({
        "indexing": False,
        "indexed_count": current_index_size(),
        "model": MODEL_NAME,
        "embedding_dim": embedding_dim
    }), 200

@app.route("/add", methods=["POST"])
def add_documents():
    """
    Add documents to the vector store for indexing.
    Expected payload: [{ id, text, meta }]
    """
    try:
        data = request.get_json(force=True)
        
        if not isinstance(data, list):
            return jsonify({"error": "Expected array of documents"}), 400

        added_count = 0
        for doc in data:
            if not isinstance(doc, dict) or 'id' not in doc or 'text' not in doc:
                continue

            doc_id = str(doc['id'])
            text = doc['text']
            meta = doc.get('meta', {}) or {}
            embedding = doc.get('embedding')

            if embedding is None:
                if model is None:
                    return jsonify({"error": "model not loaded"}), 500
                embedding = model.encode(text, convert_to_numpy=True)

            if isinstance(embedding, list):
                embedding_vector = np.array(embedding, dtype=np.float32)
            else:
                embedding_vector = np.array(embedding, dtype=np.float32)

            if embedding_vector.size == 0:
                continue

            upsert_document(doc_id, text, meta, embedding_vector)
            added_count += 1

        if added_count > 0:
            save_vector_store()

        logger.info("Added %d documents to vector store. Total: %d", added_count, current_index_size())
        return jsonify({
            "ok": True,
            "added": added_count,
            "total": current_index_size()
        }), 200

    except Exception as e:
        logger.exception("Error adding documents")
        return jsonify({"error": str(e)}), 500

@app.route("/query", methods=["POST"])
def query_documents():
    """
    Query the vector store for similar documents.
    Expected payload: { q: query_text, k: top_k_results }
    Returns: [{ id, text, score, meta }]
    """
    try:
        data = request.get_json(force=True)
        query = data.get('q') or data.get('query')
        k = data.get('k', 5)
        requested_user = data.get('userId') or data.get('user_id')
        
        if not query or not isinstance(query, str):
            return jsonify({"error": "Query text is required"}), 400
        
        if faiss_index is None or current_index_size() == 0:
            logger.warning("Query called but vector store is empty")
            return jsonify({"results": []}), 200

        if model is None:
            return jsonify({"error": "model not loaded"}), 500

        query_embedding = model.encode(query, convert_to_numpy=True)
        query_embedding = _normalize_vector(query_embedding).reshape(1, -1).astype(np.float32)

        with store_lock:
            distances, indices = faiss_index.search(query_embedding, k)

        results = []
        for score, idx in zip(distances[0], indices[0]):
            if idx == -1:
                continue
            doc_id = faiss_id_lookup.get(int(idx))
            if not doc_id:
                continue
            payload = vector_metadata.get(doc_id)
            if not payload:
                continue
            meta = payload.get('meta', {}) or {}
            if requested_user and meta.get('user') and str(meta.get('user')) != str(requested_user):
                continue
            results.append({
                'id': doc_id,
                'text': payload.get('text', ''),
                'score': float(score),
                'meta': meta
            })

        logger.info("Query '%s...' returned %d results", query[:50], len(results))
        return jsonify({"results": results}), 200

    except Exception as e:
        logger.exception("Error querying documents")
        return jsonify({"error": str(e)}), 500

@app.route("/embed", methods=["POST"])
def embed():
    """Generate embedding for a single text or a batch of texts"""
    if model is None:
        return jsonify({"error": "model not loaded"}), 500

    try:
        data = request.get_json(force=True)
        
        # Check for the new payload structure: { "payload": [{ "id": "...", "text": "..." }] }
        if "payload" in data and isinstance(data["payload"], list):
            texts_to_embed = [item.get("text") for item in data["payload"] if item.get("text")]
            if not texts_to_embed:
                return jsonify({"error": "No valid text entries found in payload"}), 400
            
            # Use the existing batch processing logic
            batch_size = int(os.getenv("EMBED_BATCH_SIZE", "32"))
            embeddings = model.encode(texts_to_embed, convert_to_numpy=True, show_progress_bar=False, batch_size=batch_size)
            
            return jsonify({
                "embeddings": embeddings.tolist(),
                "count": len(embeddings),
                "dimension": len(embeddings[0]) if len(embeddings) > 0 else 0
            }), 200

        # Fallback to original behavior for single text or list of texts
        texts = data.get("texts") or ([data.get("text")] if data.get("text") else None)
        
        if not texts or not isinstance(texts, list) or len(texts) == 0:
            return jsonify({"error": "A 'text' string or a 'texts' array is required."}), 400

        batch_size = int(os.getenv("EMBED_BATCH_SIZE", "32"))
        embeddings = model.encode(texts, convert_to_numpy=True, show_progress_bar=False, batch_size=batch_size)
        
        response_payload = {
            "embeddings": embeddings.tolist(),
            "count": len(embeddings),
            "dimension": len(embeddings[0]) if len(embeddings) > 0 else 0
        }

        # For backwards compatibility with callers expecting a single vector
        if len(embeddings) == 1:
            response_payload["embedding"] = embeddings[0].tolist()

        return jsonify(response_payload), 200

    except Exception as e:
        logger.exception("Error generating embedding(s)")
        return jsonify({"error": str(e)}), 500

@app.route("/embed/batch", methods=["POST"])
def embed_batch():
    """Generate embeddings for multiple texts (batch)"""
    if model is None:
        return jsonify({"error": "model not loaded"}), 500

    try:
        data = request.get_json(force=True)
        texts = data.get("texts") if isinstance(data, dict) else None

        if not isinstance(texts, list) or len(texts) == 0:
            return jsonify({"error": "texts must be a non-empty array"}), 400

        # optionally support batch_size via env var or request
        batch_size = int(os.getenv("EMBED_BATCH_SIZE", "32"))
        embeddings = model.encode(texts, convert_to_numpy=True, show_progress_bar=False, batch_size=batch_size)

        response_payload = {
            "embeddings": embeddings.tolist(),
            "count": len(embeddings),
            "dimension": len(embeddings[0]) if len(embeddings) > 0 else 0
        }

        if len(embeddings) == 1:
            response_payload["embedding"] = embeddings[0].tolist()

        return jsonify(response_payload), 200

    except Exception as e:
        logger.exception("Error generating batch embeddings")
        return jsonify({"error": str(e)}), 500

@app.route("/similarity", methods=["POST"])
def similarity():
    """Compute cosine similarity for two texts"""
    if model is None:
        return jsonify({"error": "model not loaded"}), 500

    try:
        data = request.get_json(force=True)
        text1 = data.get("text1")
        text2 = data.get("text2")

        if not text1 or not text2:
            return jsonify({"error": "Both text1 and text2 are required"}), 400

        embeddings = model.encode([text1, text2], convert_to_numpy=True)
        a, b = embeddings[0], embeddings[1]
        sim = float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))
        return jsonify({"similarity": sim}), 200

    except Exception as e:
        logger.exception("Error computing similarity")
        return jsonify({"error": str(e)}), 500

@app.route("/delete", methods=["POST"])
def delete_documents():
    """
    Remove documents from the vector store.
    Expected payload: { ids: ["doc_id_1", "doc_id_2"] }
    """
    global faiss_index
    try:
        data = request.get_json(force=True)
        ids_to_delete = data.get("ids")
        
        if not ids_to_delete or not isinstance(ids_to_delete, list):
            return jsonify({"error": "ids must be a non-empty list"}), 400

        deleted_count = 0
        faiss_ids_to_remove = []

        with store_lock:
            for doc_id in ids_to_delete:
                doc_id = str(doc_id)
                if doc_id in vector_metadata:
                    # Get FAISS ID to remove from index
                    payload = vector_metadata[doc_id]
                    faiss_id = payload.get("faiss_id")
                    if faiss_id is not None:
                        faiss_ids_to_remove.append(faiss_id)
                        # Remove from lookup
                        if faiss_id in faiss_id_lookup:
                            del faiss_id_lookup[faiss_id]
                    
                    # Remove from metadata
                    del vector_metadata[doc_id]
                    deleted_count += 1

            # Remove from FAISS index
            if faiss_ids_to_remove and faiss_index is not None:
                try:
                    faiss_index.remove_ids(np.array(faiss_ids_to_remove, dtype='int64'))
                except Exception as e:
                    logger.error(f"Error removing IDs from FAISS index: {e}")
                    # Continue since metadata is already updated

            if deleted_count > 0:
                save_vector_store()

        logger.info(f"Deleted {deleted_count} documents from vector store. Total: {current_index_size()}")
        return jsonify({
            "ok": True,
            "deleted": deleted_count,
            "total": current_index_size()
        }), 200

    except Exception as e:
        logger.exception("Error deleting documents")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    # Use host/port from env; debug False for production; set threaded True for concurrency if needed
    logger.info(f"Starting Flask app on {HOST}:{PORT}")
    app.run(host=HOST, port=PORT, debug=False, threaded=True)
