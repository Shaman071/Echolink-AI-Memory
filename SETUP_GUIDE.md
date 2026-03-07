# EchoLink - Complete Setup Guide

## 🎯 Overview

EchoLink is a full-stack AI memory enhancement platform with intelligent data ingestion, storage, retrieval, and visualization.

## 📋 Prerequisites

- **Node.js** >= 18.x
- **MongoDB** >= 6.0
- **Python** >= 3.8
- **Git**

## 🚀 Installation Steps

### 1. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create uploads directory
mkdir uploads

# Copy environment template
cp .env.example .env

# Edit .env and configure:
# - MONGODB_URI (your MongoDB connection string)
# - JWT_SECRET (generate a secure random string)
# - OPENAI_API_KEY (optional, for AI features)
```

### 2. Python Embedding Service Setup

```bash
cd embed_service

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
echo "VITE_API_URL=http://localhost:3001/api" > .env
```

## 🏃 Running the Application

You need to run **3 services** simultaneously:

### Terminal 1 - MongoDB

```bash
# Make sure MongoDB is running
# Windows (if installed as service):
net start MongoDB

# Or start manually:
mongod --dbpath="path/to/your/data"
```

### Terminal 2 - Backend Server

```bash
cd backend
npm run dev
# Server will start on http://localhost:3001
```

### Terminal 3 - Embedding Service

```bash
cd embed_service
.venv\Scripts\activate  # Windows
# or: source .venv/bin/activate  # Linux/Mac
python app.py
# Service will start on http://localhost:5000
```

### Terminal 4 - Frontend

```bash
cd frontend
npm run dev
# Frontend will start on http://localhost:3000
```

## 🧪 Testing

### Backend Tests

```bash
cd backend
npm test
```

### Frontend Tests

```bash
cd frontend
npm run test
```

## 📦 Features Implemented

### ✅ Core Features

- [x] User authentication (register/login)
- [x] JWT token management
- [x] File upload (PDF, DOCX, TXT, WhatsApp chats)
- [x] WhatsApp chat parser
- [x] Document parsing and fragmentation
- [x] Embedding generation (OpenAI + fallback service)
- [x] Semantic search
- [x] Fragment linking and graph
- [x] Query history
- [x] User preferences (theme, encryption)

### ✅ Backend

- [x] Express.js REST API
- [x] MongoDB with Mongoose
- [x] Authentication middleware
- [x] File upload handling
- [x] Document parser service
- [x] Embedding service integration
- [x] Search service
- [x] Summarization service
- [x] Link management

### ✅ Database Models

- [x] User model (with encryption support)
- [x] Fragment model (with embeddings)
- [x] Source model
- [x] Link model
- [x] Query model (history)

### ✅ Python Services

- [x] Embedding service (Flask + sentence-transformers)
- [x] Batch embedding support
- [x] Similarity calculation

### 🔄 Partial Implementation

- [ ] OCR for screenshots (needs Tesseract)
- [ ] OAuth providers (Google, GitHub)
- [ ] Client-side encryption
- [ ] Graph visualization (frontend)
- [ ] Timeline chart (frontend)
- [ ] Complete frontend components

### ⚠️ Notes

1. **Embedding Service**: Uses `sentence-transformers/all-MiniLM-L6-v2` model by default. First run will download ~90MB model.

2. **OpenAI**: Optional but recommended for better results. Set `OPENAI_API_KEY` in backend `.env`.

3. **File Size**: Default max upload is 50MB. Adjust in `.env` if needed.

4. **WhatsApp Parser**: Supports multiple date formats. Place `.txt` export files in uploads.

## 🐛 Troubleshooting

### MongoDB Connection Failed

```bash
# Check MongoDB is running:
mongosh
# Or:
mongo
```

### Embedding Service Fails

```bash
# Make sure virtual environment is activated
# Check Python version >= 3.8
python --version

# Reinstall dependencies
pip install --force-reinstall -r requirements.txt
```

### Port Already in Use

```bash
# Backend (3001):
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Frontend (3000):
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Embedding (5000):
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

## 📚 API Documentation

### Auth Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Import Endpoints

- `POST /api/import/upload` - Upload document
- `GET /api/import/sources` - List sources
- `GET /api/import/sources/:id` - Get source details
- `DELETE /api/import/sources/:id` - Delete source
- `POST /api/import/sources/:id/reprocess` - Reprocess source

### Query Endpoints

- `POST /api/query` - Search fragments
- `GET /api/query/fragments/:id` - Get fragment
- `GET /api/query/fragments/:id/related` - Get related fragments
- `GET /api/query/history` - Query history

### Link Endpoints

- `POST /api/links` - Create link
- `GET /api/links/fragments/:id` - Get fragment links
- `PATCH /api/links/:id` - Update link
- `DELETE /api/links/:id` - Delete link
- `GET /api/links/fragments/:id/suggestions` - Get link suggestions

## 🔒 Security

- Passwords hashed with bcrypt
- JWT tokens for authentication
- CORS enabled
- Input validation with express-validator
- File type restrictions
- File size limits

## 📊 Database Indexes

Ensure these indexes are created for optimal performance:

```javascript
// Fragments
db.fragments.createIndex({ user: 1, datetime: -1 });
db.fragments.createIndex({ content: "text", summary: "text" });

// Links
db.links.createIndex(
  { sourceFragment: 1, targetFragment: 1, type: 1, user: 1 },
  { unique: true }
);

// Queries
db.queries.createIndex({ user: 1, createdAt: -1 });
```

## 🎨 Frontend Stack

- React 18
- Vite
- TailwindCSS
- React Router v6
- React Query
- Framer Motion
- Recharts (for visualizations)
- Cytoscape (for graph)

## 🛠️ Development

### Hot Reload

All services support hot reload:

- Backend: `nodemon`
- Frontend: Vite HMR
- Embedding: Flask debug mode

### Code Quality

```bash
# Backend
npm run lint
npm run format

# Frontend
npm run lint
npm run format
```

## 📈 Next Steps

1. Install and run all services
2. Create a user account
3. Upload a WhatsApp chat or document
4. Wait for processing (check backend logs)
5. Try searching with natural language queries
6. Explore fragments and links

## 🤝 Support

For issues, check:

1. All services are running
2. MongoDB is accessible
3. Environment variables are set correctly
4. Check logs in each terminal

## 🎉 Success!

If you can:

- Register/login
- Upload a file
- See it processing
- Search and get results

Then **EchoLink is working correctly!**
