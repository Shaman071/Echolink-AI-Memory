# QUICKSTART - Get Echolink Running in 10 Minutes

## Prerequisites Check (2 minutes)

```bash
# Check Node.js
node --version  # Should be 16+

# Check Python
python --version  # Should be 3.8+

# Check npm
npm --version  # Should be 8+

# Check MongoDB connection works
mongo "mongodb+srv://latnasaga30_db_user:shaman123@cluster0.wdjj1ep.mongodb.net/?appName=Cluster0"
# Should connect successfully
```

## Step 1: Start Embedding Service (1 minute)

```powershell
cd embed_service
pip install -r requirements.txt
python app.py
```

✓ You should see: `Running on http://127.0.0.1:5000`

## Step 2: Start Backend (1 minute)

In a new terminal:

```powershell
cd backend
npm install  # If you haven't done this
npm start
```

✓ You should see: `Server running on port 3001` and `Connected to MongoDB`

## Step 3: Start Frontend (1 minute)

In a new terminal:

```powershell
cd frontend
npm install  # If you haven't done this
npm run dev
```

✓ You should see: `Local: http://localhost:3000`

## Step 4: Test the Full Flow (5 minutes)

1. Open http://localhost:3000 in your browser
2. Register: Create a new account with email and password
3. Upload a test file:
   - Go to "Uploads" page
   - Drag and drop or select the `sample_whatsapp.txt` file (or any .txt file)
   - Wait for the upload to complete (watch backend logs)
4. Search:
   - Go to "Search" page
   - Type: "Why choose React?" or "MERN"
   - Press Enter and wait for results
5. View results:
   - You should see:
     - AI Summary at the top
     - Evidence cards with relevance scores
     - Activity timeline
     - Option to view knowledge graph

## Troubleshooting

### Issue: "No results found" in search

**Solution:**
1. Check files uploaded successfully:
   ```bash
   # In backend logs, you should see "Processed X fragments"
   ```
2. Verify embedding service is running:
   ```bash
   curl http://localhost:5000/health
   ```
3. Check MongoDB has fragments:
   ```bash
   # Use MongoDB Compass to view: collection 'fragments'
   # Or use mongo CLI
   ```

### Issue: Upload stuck on "Pending"

**Solution:**
1. Check backend logs for errors (look for red text)
2. Verify file is readable (not corrupted)
3. File must be < 50MB
4. Restart backend:
   ```bash
   # Press Ctrl+C to stop
   npm start  # Restart
   ```

### Issue: Can't connect to MongoDB

**Solution:**
1. Check MongoDB connection string in `backend/.env`
2. Verify internet connection (MongoDB Atlas requires it)
3. Check IP whitelist in MongoDB Atlas (should include 0.0.0.0/0 for local dev)
4. Try connecting directly:
   ```bash
   mongo "your-connection-string"
   ```

### Issue: Port already in use

**Solution:**
```powershell
# Find process on port 3001 (backend)
Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess | Stop-Process -Force

# Find process on port 3000 (frontend)
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force

# Find process on port 5000 (embedding)
Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process -Force
```

## Optional: Enable OpenAI Summaries

For better AI summaries:

1. Get API key from https://platform.openai.com/api-keys
2. Edit `backend/.env` and add:
   ```
   OPENAI_API_KEY=sk-your-key-here
   ```
3. Restart backend:
   ```powershell
   npm start
   ```
4. Now searches will use OpenAI GPT-3.5 for summaries instead of local fallback

## What's Happening Under the Hood

```
User uploads file
    ↓
Backend receives upload → parses into fragments → stores in MongoDB
    ↓
Embedding service computes vector for each fragment
    ↓
Frontend shows "Processed" status
    ↓
User enters search query
    ↓
Backend computes query embedding → finds similar fragments → calls LLM for summary
    ↓
Results returned to frontend with:
  - AI summary
  - Evidence cards
  - Relevance scores
  - Timeline
  - Graph of connections
```

## Next Steps

1. **Try different queries:**
   - "What is MERN stack?"
   - "Why React?"
   - "Benefits of Node.js"

2. **Upload more files:**
   - Try PDF files (if you have them)
   - Try multiple files to see connections

3. **Explore graph:**
   - Click "Open Graph" on search results
   - Double-click nodes to see full fragments
   - See automatic connections between related content

4. **Check dashboard:**
   - Go to Dashboard to see stats
   - View activity timeline
   - See total fragments and connections

## Production Deployment

When ready for production:

1. Set `NODE_ENV=production` in backend/.env
2. Use a real vector database (Pinecone, Weaviate) instead of in-memory
3. Set up proper monitoring (ELK stack)
4. Use HTTPS instead of HTTP
5. Set up automated backups for MongoDB
6. Add rate limiting and API authentication

For detailed production setup, see `README.md`

## Support

If something breaks:

1. Run the diagnostic:
   ```bash
   node diagnostic.js
   ```
   This will check all services and provide actionable fixes.

2. Check the full report:
   ```bash
   cat FIX_REPORT.txt
   ```

3. Review backend logs in the terminal (red text = errors)

4. Check browser console (F12 → Console tab)

Good luck! 🚀
