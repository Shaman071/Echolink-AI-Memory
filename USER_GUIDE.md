# EchoLink User Guide

**Welcome to EchoLink!** 🎉

Your personal, privacy-first knowledge graph for organizing conversations, documents, and memories.

---

## 📚 Table of Contents

1. [Getting Started](#getting-started)
2. [Uploading Data](#uploading-data)
3. [Searching Your Knowledge](#searching-your-knowledge)
4. [Understanding the Graph](#understanding-the-graph)
5. [Timeline View](#timeline-view)
6. [Managing Your Data](#managing-your-data)
7. [Privacy & Security](#privacy--security)
8. [Troubleshooting](#troubleshooting)

---

## 🚀 Getting Started

### Creating an Account

1. **Visit the application** at your EchoLink URL
2. **Click "Sign Up"** in the top right
3. **Enter your details:**
   - Full name
   - Email address
   - Strong password (at least 8 characters with uppercase, lowercase, and numbers)
4. **Click "Create Account"**

You'll be logged in automatically and taken to your dashboard.

### Your Dashboard

After logging in, you'll see:
- **Total Fragments:** Number of text pieces in your knowledge base
- **Sources:** Number of uploaded documents
- **Links:** Connections discovered between fragments
- **Recent Activity:** Your latest uploads and searches

---

## 📤 Uploading Data

### What You Can Upload

EchoLink supports multiple file types:
- **WhatsApp chats** (.txt export files)
- **PDF documents** (.pdf)
- **Word documents** (.docx, .doc)
- **Images** (.png, .jpg) - text will be extracted via OCR
- **Plain text** (.txt, .md)

### How to Upload

**Method 1: Drag and Drop**
1. Go to the **Uploads** page
2. **Drag your file** into the upload area
3. Wait for the upload to complete
4. Processing will start automatically

**Method 2: Click to Browse**
1. Click the **upload area**
2. **Select your file** from your computer
3. Click **Open**

**Method 3: Quick Text Upload**
1. Click the **"Text" tab** in the upload area
2. **Paste or type** your content
3. Give it a **title**
4. Click **"Upload"**

### WhatsApp Chat Upload

To upload a WhatsApp conversation:

1. **Export chat from WhatsApp:**
   - Open the chat in WhatsApp
   - Tap the three dots (⋮) → More → Export chat
   - Choose "Without Media"
   - Save the .txt file

2. **Upload to EchoLink:**
   - Drag the .txt file into EchoLink
   - The app will automatically detect it's a WhatsApp chat
   - Messages will be parsed with timestamps and senders

3. **What gets extracted:**
   - Every message becomes a "fragment"
   - Timestamp preserved
   - Sender identified
   - Keywords and topics extracted

### Upload Limits

- **Maximum file size:** 50 MB
- **Supported formats:** txt, pdf, docx, png, jpg
- **Processing time:** Usually 10-30 seconds depending on size

### Viewing Upload Status

After uploading, check the **Uploads** page to see:
- **Pending:** Upload received, waiting to process
- **Processing:** Currently being parsed
- **Indexed:** Ready for search!
- **Error:** Something went wrong (hover for details)

---

## 🔍 Searching Your Knowledge

### How to Search

1. Go to the **Search** page
2. **Type your question** in natural language
   - Example: "What did we discuss about the project deadline?"
   - Example: "Show me conversations about travel plans"
3. **Press Enter** or click the search icon

### Understanding Results

**AI Summary (Top)**
- A generated summary of what was found
- Highlights key points across all matching fragments

**Evidence Cards (Below)**
- Individual text fragments that match your query
- Shows:
  - **Content:** The actual text
  - **Sender:** Who wrote it (if available)
  - **Date:** When it was created
  - **Relevance Score:** How well it matches (0-100%)

**Timeline (Optional)**
- Click **"Show Timeline"** to see when fragments occurred
- Click on a date to filter results

**Graph (Optional)**
- Click **"Open Graph"** to see connections
- Visualizes how fragments relate to each other

### Search Tips

✅ **Good Searches:**
- "Summarize our meeting notes from last week"
- "What are the main topics in my documents?"
- "Show conversations about vacation"

❌ **Less Effective:**
- Single words like "hello"
- Very vague queries like "something"
- Queries with special characters

### Advanced Features

**Keyboard Shortcuts:**
- Press **"/"** to focus the search box from anywhere
- Press **Enter** to search

**Suggested Questions:**
- If you're not sure what to search, try the suggested questions
- These update based on your data

---

## 🕸️ Understanding the Graph

### What is the Knowledge Graph?

The graph visualizes **connections between your fragments**. EchoLink automatically finds relationships like:
- **Same Topic:** Fragments discussing similar subjects
- **Follow-up:** Messages that continue a conversation
- **Supports:** Ideas that reinforce each other
- **Contradicts:** Conflicting statements
- **References:** Mentions or citations

### Viewing the Graph

1. Go to the **Links** page
2. The graph will load automatically
3. **Interact with it:**
   - **Drag nodes** to rearrange
   - **Zoom** with mouse wheel
   - **Double-click a node** to see the full fragment
   - **Hover over connections** to see relationship type

### Graph Elements

- **Nodes (circles):** Individual fragments
  - Size indicates importance (more connections = larger)
  - Color indicates topic or category
- **Edges (lines):** Connections between fragments
  - Thickness indicates strength
  - Color indicates relationship type

### When to Use the Graph

- **Exploring connections:** See how ideas relate
- **Finding patterns:** Discover recurring themes
- **Visual overview:** Get a bird's-eye view of your knowledge

---

## 📅 Timeline View

### What is the Timeline?

The timeline shows your fragments chronologically, helping you:
- See activity over time
- Filter by date ranges
- Identify busy periods

### Using the Timeline

1. Perform a **search**
2. Click **"Show Timeline"**
3. **Interact:**
   - Hover over bars to see counts
   - Click a date to filter results to that day

### Timeline Features

- **Daily/Weekly/Monthly views:** Adjust granularity
- **Activity peaks:** See when you were most active
- **Date filtering:** Click to focus on specific periods

---

## 🗂️ Managing Your Data

### Viewing Your Sources

Go to **Uploads** page to see:
- All uploaded documents
- Fragment count per source
- Upload dates
- Processing status

### Deleting Data

**Delete a Single Source:**
1. Go to **Uploads**
2. Click the **trash icon** next to the source
3. Confirm deletion
4. All related fragments and links will be removed

**Export Before Deleting:**
Always export your data before deletion (see below).

### Exporting Your Data

**Full Export:**
1. Go to **Settings** → **Data Management**
2. Click **"Export All Data"**
3. Choose format:
   - **JSON:** Single file with all data
   - **ZIP:** Organized files for each data type
4. Download will start automatically

**Single Source Export:**
1. Go to **Uploads**
2. Click the **export icon** next to a source
3. Download JSON file

**What Gets Exported:**
- All sources
- All fragments
- All links
- Search history
- User preferences

### Importing Data

**Restore from Backup:**
1. Go to **Settings** → **Data Management**
2. Click **"Import Data"**
3. **Select your export file** (JSON or ZIP)
4. Click **"Import"**
5. Wait for processing
6. **Review results:**
   - Items imported
   - Duplicates skipped
   - Any errors

**Important:** Import will NOT delete existing data. It adds to what you have.

### Reindexing

If search results seem off:
1. Go to **Admin** page (if available)
2. Click **"Reindex All Sources"**
3. Wait for completion
4. Try searching again

---

## 🔒 Privacy & Security

### Data Privacy

✅ **Your data stays yours:**
- Stored in your database only
- Not shared with third parties
- Can be exported anytime
- Can be deleted anytime

✅ **Local processing:**
- Embeddings generated locally (no external API calls)
- Summarization uses local fallback by default

❌ **Optional External Services:**
- OpenAI for better summaries (if you configure API key)
- Google Drive/Gmail/Slack connectors (if you enable OAuth)

### Security Features

- **Encrypted passwords:** Passwords are hashed with bcrypt
- **Secure sessions:** JWT tokens with expiration
- **Rate limiting:** Protection against abuse
- **Input validation:** XSS and injection prevention
- **File validation:** Type and size limits

### GDPR Compliance

You have the right to:
- **Access:** Export all your data
- **Rectification:** Edit or update information
- **Erasure:** Delete your account and all data
- **Portability:** Download data in standard format

To delete your account:
1. Export your data first
2. Go to **Settings** → **Account**
3. Click **"Delete Account"**
4. Confirm (this cannot be undone)

### Best Practices

- Use a **strong password**
- **Don't share** your account
- **Review uploaded data** before uploading sensitive information
- **Export backups** regularly
- **Enable 2FA** if available

---

## ❓ Troubleshooting

### Upload Issues

**Problem:** Upload stuck at "Processing"
- **Solution:** Wait 5 minutes. If still stuck, refresh the page. The upload may complete in the background.

**Problem:** "File type not supported"
- **Solution:** Check file extension. Supported: .txt, .pdf, .docx, .png, .jpg, .md

**Problem:** "File too large"
- **Solution:** Files must be under 50MB. Try splitting the file or compressing images.

### Search Issues

**Problem:** No results found
- **Solution:** 
  - Check if your uploads are "Indexed" (not "Pending")
  - Try different search terms
  - Make sure you have uploaded data

**Problem:** Results are not relevant
- **Solution:**
  - Be more specific in your query
  - Try the "Reindex" function in Admin page
  - Use natural language questions

### Graph Issues

**Problem:** Graph not loading
- **Solution:**
  - Refresh the page
  - Check browser console for errors
  - Try with fewer nodes (use search first to filter)

**Problem:** Graph is too slow
- **Solution:**
  - Filter results first with a search
  - Close other browser tabs
  - Use a modern browser (Chrome, Firefox, Safari)

### Performance Issues

**Problem:** App is slow
- **Solution:**
  - Clear browser cache
  - Check internet connection
  - Reduce number of open tabs
  - Contact administrator if self-hosted

### Login Issues

**Problem:** Forgot password
- **Solution:**
  - Click "Forgot Password" on login page
  - Enter your email
  - Check inbox for reset link
  - If email doesn't arrive, check spam folder

**Problem:** Session expired
- **Solution:**
  - Simply log in again
  - Your data is safe and unchanged

---

## 🆘 Getting Help

### Quick Reference

| Task | Page | Action |
|------|------|--------|
| Upload file | Uploads | Drag & drop or click to browse |
| Search | Search | Type query and press Enter |
| View graph | Links | Automatic visualization |
| Export data | Settings | Data Management → Export |
| Delete source | Uploads | Click trash icon |
| View profile | Settings | Account tab |

### Support Resources

1. **Check the FAQ** - Common questions answered
2. **Review this guide** - Most topics covered here
3. **Check system status** - Admin page if available
4. **Contact administrator** - If self-hosted
5. **GitHub Issues** - Report bugs or suggest features

---

## 💡 Tips & Tricks

### Getting the Most Out of EchoLink

1. **Upload regularly:** The more data, the better the connections
2. **Use descriptive titles:** Makes sources easier to find
3. **Search often:** Discovery happens through searching
4. **Explore the graph:** You'll find unexpected connections
5. **Export backups:** Weekly exports recommended
6. **Review privacy settings:** Make sure you're comfortable with data handling

### Power User Features

- **Bulk upload:** Upload multiple files at once
- **WhatsApp automation:** Set up auto-exports from WhatsApp
- **Keyboard shortcuts:** "/" for search, "Esc" to close modals
- **Dark mode:** Toggle in Settings
- **Custom queries:** Save favorite searches (coming soon)

---

## 🎯 Next Steps

Now that you know the basics:

1. **Upload your first document** → Go to Uploads
2. **Try a search** → Go to Search
3. **Explore the graph** → Go to Links
4. **Set up backups** → Go to Settings

**Welcome to your personal knowledge graph!** 🚀

---

**Version:** 1.0.0  
**Last Updated:** December 7, 2025

For technical documentation, see the main README.md
