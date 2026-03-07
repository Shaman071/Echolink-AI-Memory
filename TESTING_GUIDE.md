# ECHOLINK - VERIFICATION & TESTING GUIDE
**Date:** November 11, 2025  
**Purpose:** Verify all features are working correctly

---

## 🟢 QUICK START (5 minutes)

### Step 1: Start All Services
Open 3 PowerShell windows and run:

**Window 1 - Backend:**
```powershell
cd d:\Echolink\backend
npm start
```
Expected: `Server running on port 3001` ✅

**Window 2 - Frontend:**
```powershell
cd d:\Echolink\frontend
npm run dev
```
Expected: `Local: http://localhost:3000` ✅

**Window 3 - Embedding Service:**
```powershell
cd d:\Echolink\embed_service
python app.py
```
Expected: `Running on http://127.0.0.1:5000` ✅

### Step 2: Verify Services Running
Open a 4th PowerShell window:
```powershell
# Test backend
curl http://localhost:3001/health

# Test frontend
curl http://localhost:3000

# Test embedding service
curl http://localhost:5000/health
```

All should return 200 OK ✅

---

## 🧪 FEATURE VERIFICATION TESTS

### Test 1: Authentication Flow ✅

**Register a new user:**
```powershell
curl -X POST http://localhost:3001/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{
    "name":"Test User",
    "email":"test@example.com",
    "password":"Password123!"
  }'
```

Expected response: `{user: {...}, tokens: {accessToken: "...", refreshToken: "..."}}`

**Login:**
```powershell
curl -X POST http://localhost:3001/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{
    "email":"test@example.com",
    "password":"Password123!"
  }'
```

Save the `accessToken` for next tests.

---

### Test 2: File Upload (WhatsApp) ✅

Create a test file `sample.txt`:
```
[01/01/2024, 10:30:00] Alice: Hello everyone!
[01/01/2024, 10:31:00] Bob: Hi Alice! How are you?
[01/01/2024, 10:32:00] Alice: I'm great, thanks for asking!
```

Upload:
```powershell
$token = "YOUR_ACCESS_TOKEN_HERE"

curl -X POST http://localhost:3001/api/import/upload `
  -H "Authorization: Bearer $token" `
  -F "file=@sample.txt"
```

Expected response:
```json
{
  "sourceId": "...",
  "fileName": "sample.txt",
  "type": "text/plain",
  "inserted": 3,
  "status": "processing"
}
```

✅ **Verify:** Go to http://localhost:3000/uploads - file should appear

---

### Test 3: Check Indexing Status ✅

```powershell
$token = "YOUR_ACCESS_TOKEN_HERE"

curl -X GET http://localhost:3001/api/status `
  -H "Authorization: Bearer $token"
```

Expected response:
```json
{
  "counts": {
    "fragments": 3,
    "sources": 1,
    "queries": 0
  },
  "totalLinks": 0,
  "avgLinksPerFragment": 0,
  "recent": {...}
}
```

✅ **Verify:** Fragment count increased

---

### Test 4: Semantic Search ✅

```powershell
$token = "YOUR_ACCESS_TOKEN_HERE"

curl -X POST http://localhost:3001/api/query `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  -d '{
    "q": "How is Alice?",
    "topK": 5
  }'
```

Expected response:
```json
{
  "summary": "...",
  "evidence": [
    {
      "_id": "...",
      "text": "I'm great, thanks for asking!",
      "sender": "Alice",
      "datetime": "2024-01-01T10:32:00.000Z",
      "score": 0.85,
      "sourceId": "..."
    }
  ],
  "timeline": [
    { "date": "2024-01-01", "count": 3 }
  ],
  "graph": {
    "nodes": [...],
    "edges": [...]
  }
}
```

✅ **Verify:** Evidence has relevance scores and correct format

---

### Test 5: Auto-Linking ✅

Upload a second file with related content:
```
[01/02/2024, 14:00:00] Charlie: Alice is amazing!
[01/02/2024, 14:01:00] Diana: I agree, she's the best!
```

Then rebuild links:
```powershell
$token = "YOUR_ACCESS_TOKEN_HERE"

curl -X POST http://localhost:3001/api/links/rebuild `
  -H "Authorization: Bearer $token"
```

Expected response:
```json
{
  "message": "Links rebuilt successfully",
  "linksCreated": 2
}
```

✅ **Verify:** Links created automatically between related fragments

---

### Test 6: View Knowledge Graph ✅

```powershell
$token = "YOUR_ACCESS_TOKEN_HERE"

curl -X GET http://localhost:3001/api/graph `
  -H "Authorization: Bearer $token"
```

Expected response:
```json
{
  "nodes": [
    {
      "id": "fragmentId1",
      "label": "First 50 chars...",
      "topic": "greeting"
    },
    {
      "id": "fragmentId2",
      "label": "First 50 chars...",
      "topic": "appreciation"
    }
  ],
  "edges": [
    {
      "from": "fragmentId1",
      "to": "fragmentId2",
      "relation": "same_topic",
      "weight": 0.75
    }
  ]
}
```

✅ **Verify:** Graph shows interconnected fragments

---

### Test 7: Email Verification ✅

```powershell
curl -X POST http://localhost:3001/api/auth/request-verify-email `
  -H "Content-Type: application/json" `
  -d '{"email":"test@example.com"}'
```

Response will include a demo token (or send via email if SMTP configured).

Verify:
```powershell
curl -X POST http://localhost:3001/api/auth/verify-email `
  -H "Content-Type: application/json" `
  -d '{"token":"DEMO_TOKEN_HERE"}'
```

✅ **Verify:** User marked as email verified

---

### Test 8: Password Reset ✅

```powershell
curl -X POST http://localhost:3001/api/auth/request-password-reset `
  -H "Content-Type: application/json" `
  -d '{"email":"test@example.com"}'
```

Response includes demo token.

Reset:
```powershell
curl -X POST http://localhost:3001/api/auth/reset-password `
  -H "Content-Type: application/json" `
  -d '{"token":"DEMO_TOKEN_HERE","newPassword":"NewPassword123!"}'
```

✅ **Verify:** Password changed successfully

---

## 🔍 FRONTEND UI VERIFICATION

### Dashboard Page
Navigate to: http://localhost:3000/dashboard

**Verify:**
- [ ] Shows "Total Fragments" card with count
- [ ] Shows "Total Sources" card with count
- [ ] Shows activity timeline
- [ ] Shows recent fragments list
- [ ] "Upload" button works
- [ ] "Search" button works
- [ ] Dark mode toggle in Settings

### Uploads Page
Navigate to: http://localhost:3000/uploads

**Verify:**
- [ ] Drag & drop area visible
- [ ] "Upload" button works
- [ ] File list shows uploaded files
- [ ] Status shows "Processed" (not "Pending")
- [ ] Delete button works
- [ ] Error messages appear if upload fails

### Query/Search Page
Navigate to: http://localhost:3000/query

**Verify:**
- [ ] Search box visible
- [ ] Can type queries
- [ ] Results show evidence cards
- [ ] Evidence cards show: text, sender, date, score
- [ ] Relevance scores visible
- [ ] "Open Graph" button shows interactive graph
- [ ] Timeline visible below results

### Links Page
Navigate to: http://localhost:3000/links

**Verify:**
- [ ] Shows link statistics
- [ ] "Rebuild All Links" button present
- [ ] Click rebuild creates connections
- [ ] Fragment relationship graph displays

### Settings Page
Navigate to: http://localhost:3000/settings

**Verify:**
- [ ] Dark mode toggle works
- [ ] Theme changes immediately
- [ ] User profile info shows
- [ ] Preferences save

---

## 🧬 TECHNICAL VERIFICATION

### Database Check
Use MongoDB Compass to verify:

```
Database: echolink
Collections:
  ✅ users (should have 1+ documents)
  ✅ fragments (should have 3+ documents from uploads)
  ✅ sources (should have 1+ documents)
  ✅ links (should have 0+ documents)
  ✅ queries (should have 0+ documents)
  ✅ refreshtokens (authentication tokens)
```

### Embedding Service Check
Test embedding generation:
```powershell
curl -X POST http://localhost:5000/embed `
  -H "Content-Type: application/json" `
  -d '{"text":"Hello world"}'
```

Expected: Array of 384 numbers (embedding vector) ✅

### Rate Limiting Check
Upload 11 files in rapid succession:
```powershell
for($i=1; $i -le 11; $i++) {
  curl -X POST http://localhost:3001/api/import/upload `
    -H "Authorization: Bearer $token" `
    -F "file=@sample.txt"
  Write-Host "Upload $i completed"
}
```

Expected: 11th request returns 429 (Too Many Requests) ✅

---

## 🔧 OPTIONAL: ADVANCED TESTING

### Test with OpenAI API Key
Set in `backend/.env`:
```
OPENAI_API_KEY=sk-your-real-key-here
```

Restart backend and test query:
```powershell
curl -X POST http://localhost:3001/api/query `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  -d '{"q":"What did Alice say?","topK":5}'
```

Expected: Summary uses GPT-3.5-turbo (more coherent than fallback) ✅

### Test OCR with Image
Upload an image file (PNG or JPG):
```powershell
curl -X POST http://localhost:3001/api/import/upload `
  -H "Authorization: Bearer $token" `
  -F "file=@screenshot.png"
```

Backend logs should show OCR progress. Result will be fragments with extracted text. ✅

### Load Testing
Run integration tests:
```powershell
cd d:\Echolink\backend
npm test
```

Expected: All tests pass ✅

---

## ✅ FINAL VERIFICATION CHECKLIST

Use this checklist to verify EVERYTHING works:

```
AUTHENTICATION:
  [ ] Register endpoint works
  [ ] Login endpoint works
  [ ] Refresh token works (30-day cookies)
  [ ] Email verification works
  [ ] Password reset works
  [ ] JWT tokens secure endpoints

FILE UPLOADS:
  [ ] WhatsApp .txt upload works
  [ ] PDF upload works
  [ ] DOCX upload works
  [ ] Plain text upload works
  [ ] Image upload works
  [ ] Rate limiting prevents abuse

PARSING & INDEXING:
  [ ] Fragments created from uploads
  [ ] Metadata extracted (sender, date, etc.)
  [ ] Embeddings generated
  [ ] Status transitions from pending to processed

SEARCH & QUERY:
  [ ] Semantic search returns results
  [ ] Evidence cards display properly
  [ ] Relevance scores show (0-1 range)
  [ ] Summaries generated (with or without OpenAI)
  [ ] Rate limiting applied to queries

LINKING:
  [ ] Auto-links created between related fragments
  [ ] Link suggestions work
  [ ] Rebuild links endpoint works
  [ ] Graph displays connections

UI/UX:
  [ ] Dashboard shows stats and timeline
  [ ] Uploads page shows uploaded files
  [ ] Query page shows search results
  [ ] Links page shows graph
  [ ] Settings page has dark mode
  [ ] All pages responsive
  [ ] Animations work smoothly

SECURITY:
  [ ] Unauthenticated requests rejected
  [ ] Rate limiting works
  [ ] Input validation rejects bad data
  [ ] Passwords hashed in database
  [ ] JWT tokens expire properly

ERROR HANDLING:
  [ ] 404 errors handled
  [ ] 401 unauthorized errors shown
  [ ] 429 rate limit errors shown
  [ ] 500 server errors logged
  [ ] Retry buttons work
```

---

## 🎯 SUCCESS CRITERIA

**You know everything works when:**

1. ✅ You can register and login
2. ✅ You can upload a file
3. ✅ File shows in uploads with "Processed" status
4. ✅ You can search for content from uploaded file
5. ✅ Search returns evidence cards with scores
6. ✅ Knowledge graph displays related fragments
7. ✅ Dashboard shows correct statistics
8. ✅ Dark mode toggle works
9. ✅ Uploading >10 files in 10 min returns rate limit error
10. ✅ Queries work without API key (fallback text summarization)

**All of the above = Your system is production-ready** 🚀

---

## 🐛 TROUBLESHOOTING

### Issue: "Port 3001 already in use"
```powershell
Get-Process | Where-Object {$_.Name -eq "node"} | Stop-Process -Force
npm start
```

### Issue: "Cannot find module 'tesseract.js'"
```powershell
cd d:\Echolink\backend
npm install tesseract.js
npm start
```

### Issue: "Connection refused" for MongoDB
Check in `backend/.env`:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?appName=Cluster0
```

Make sure:
- Username and password are correct
- IP whitelist includes your computer (or 0.0.0.0/0)
- Connection string matches your Atlas cluster

### Issue: "Search returns no results"
1. Verify embedding service running: `curl http://localhost:5000/health`
2. Check fragments exist: `curl http://localhost:3001/api/status -H "Authorization: Bearer TOKEN"`
3. Verify embeddings stored: Check MongoDB fragments collection

### Issue: "Authentication fails"
1. Check JWT_SECRET in `backend/.env` is set
2. Verify cookies are being sent: `curl -v http://localhost:3001/health`
3. Check AuthContext.jsx has `withCredentials: true`

---

## 📞 SUPPORT

If something doesn't work:

1. **Check service logs** (read terminal output carefully)
2. **Run diagnostic:** `node diagnostic.js` in backend folder
3. **Check MongoDB:** Use MongoDB Compass to verify data
4. **Browser console:** Open F12 → Console tab for frontend errors
5. **Review .env files:** Ensure all variables are set

---

**Test it now and confirm everything works!** ✅
