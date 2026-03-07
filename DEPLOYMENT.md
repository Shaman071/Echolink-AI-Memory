# EchoLink Deployment Guide

**Version:** 1.0.0  
**Last Updated:** December 7, 2025

This guide covers deploying EchoLink to production environments.

---

## 📋 Pre-Deployment Checklist

- [ ] MongoDB database ready (Atlas or self-hosted)
- [ ] Environment variables configured
- [ ] Domain name configured (optional)
- [ ] SSL certificate ready (recommended)
- [ ] Backup strategy planned
- [ ] Monitoring tools configured

---

## 🐳 Option 1: Docker Deployment (Recommended)

### Local Production Server

**1. Install Docker and Docker Compose**
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install docker.io docker-compose

# Verify installation
docker --version
docker-compose --version
```

**2. Clone and Configure**
```bash
git clone <your-repo-url>
cd echolink

# Create production environment file
cp .env.example .env.production
nano .env.production
```

**3. Production Environment Variables**
```env
# Backend
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb://mongodb:27017/echolink
JWT_SECRET=<generate-strong-secret-here>
JWT_EXPIRATION=7d
JWT_REFRESH_EXPIRATION=30d
EMBEDDING_SERVICE_URL=http://embed-service:5000
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://api.yourdomain.com

# Optional: OpenAI
OPENAI_API_KEY=sk-your-key-here

# Optional: OAuth Connectors
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-secret
GMAIL_CLIENT_ID=your-client-id
GMAIL_CLIENT_SECRET=your-secret
SLACK_CLIENT_ID=your-client-id
SLACK_CLIENT_SECRET=your-secret

# Embedding Service
MODEL_NAME=sentence-transformers/all-MiniLM-L6-v2
PORT=5000
```

**4. Build and Start**
```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Check health
docker-compose ps
```

**5. Configure Nginx Reverse Proxy (Optional)**
```nginx
# /etc/nginx/sites-available/echolink
server {
    listen 80;
    server_name yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # SSE support
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Connection '';
        chunked_transfer_encoding off;
    }
}
```

**6. SSL with Let's Encrypt**
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## ☁️ Option 2: Render.com Deployment

### Frontend Deployment

**1. Create New Static Site**
- Go to Render Dashboard → New → Static Site
- Connect your GitHub repository
- Configure:
  - **Build Command:** `cd frontend && npm install && npm run build`
  - **Publish Directory:** `frontend/dist`
  - **Environment Variables:**
    - `VITE_API_URL` = `https://your-backend.onrender.com/api`

**2. Configure Headers (Optional)**
Create `frontend/render.yaml`:
```yaml
services:
  - type: web
    name: echolink-frontend
    env: static
    buildCommand: cd frontend && npm install && npm run build
    staticPublishPath: frontend/dist
    headers:
      - path: /*
        name: X-Frame-Options
        value: SAMEORIGIN
      - path: /*
        name: X-Content-Type-Options
        value: nosniff
```

### Backend Deployment

**1. Create New Web Service**
- Go to Render Dashboard → New → Web Service
- Connect your GitHub repository
- Configure:
  - **Build Command:** `cd backend && npm install`
  - **Start Command:** `cd backend && npm start`
  - **Environment Variables:** (Add all from .env)

**2. Add MongoDB**
- Option A: Use MongoDB Atlas (recommended)
- Option B: Render PostgreSQL (if switching DBs)
- Set `MONGODB_URI` in environment

### Embedding Service Deployment

**1. Create Docker Web Service**
- New → Web Service
- **Dockerfile Path:** `Dockerfile.embed`
- **Docker Context:** `embed_service`
- Configure:
  - **Environment Variables:**
    - `MODEL_NAME` = `sentence-transformers/all-MiniLM-L6-v2`
    - `PORT` = `5000`

---

## 🚂 Option 3: Railway Deployment

**1. Install Railway CLI**
```bash
npm install -g @railway/cli
railway login
```

**2. Initialize Project**
```bash
cd echolink
railway init
```

**3. Deploy Services**

**Backend:**
```bash
cd backend
railway up
railway variables set NODE_ENV=production
railway variables set MONGODB_URI=<your-mongodb-uri>
railway variables set JWT_SECRET=<your-secret>
railway domain # Get backend URL
```

**Frontend:**
```bash
cd frontend
railway up
railway variables set VITE_API_URL=<backend-url>/api
railway domain
```

**Embedding Service:**
```bash
cd embed_service
railway up
railway domain
```

**4. Link Services**
Update backend `EMBEDDING_SERVICE_URL` with embed service URL.

---

## 🔷 Option 4: AWS EC2 Deployment

**1. Launch EC2 Instance**
- AMI: Ubuntu 22.04 LTS
- Instance type: t3.medium (minimum)
- Security Group: Allow 80, 443, 22

**2. SSH and Install Dependencies**
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip

# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Python
sudo apt-get install -y python3 python3-pip python3-venv

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt-get install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

**3. Deploy Application**
```bash
# Clone repository
git clone <your-repo-url>
cd echolink

# Setup backend
cd backend
npm install
cp .env.example .env
nano .env  # Edit with production values
pm2 start server.js --name echolink-backend
pm2 save
pm2 startup

# Setup embedding service
cd ../embed_service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pm2 start "python app.py" --name echolink-embed
pm2 save

# Build frontend
cd ../frontend
npm install
npm run build

# Copy to Nginx
sudo cp -r dist/* /var/www/html/
```

**4. Configure Nginx**
```bash
sudo nano /etc/nginx/sites-available/echolink
# Use nginx config from Docker section above

sudo ln -s /etc/nginx/sites-available/echolink /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🌊 Option 5: DigitalOcean Deployment

**1. Create Droplet**
- Ubuntu 22.04
- At least 2GB RAM
- Enable monitoring

**2. Use One-Click Docker App**
Or follow EC2 instructions above.

**3. DigitalOcean App Platform (Alternative)**
- Create new App
- Connect GitHub repository
- Add 3 components:
  - Web Service (Backend)
  - Static Site (Frontend)
  - Worker (Embedding Service)

**4. Configure Environment**
Same as Render deployment.

---

## 🗄️ Database Setup

### MongoDB Atlas (Recommended)

**1. Create Cluster**
- Go to mongodb.com/cloud/atlas
- Create free tier cluster
- Select region closest to your app

**2. Configure**
- Database Access: Create user with read/write
- Network Access: Add your server IP (or 0.0.0.0/0 for testing)
- Get connection string

**3. Connection String**
```
mongodb+srv://username:password@cluster.mongodb.net/echolink?retryWrites=true&w=majority
```

### Self-Hosted MongoDB

**1. Installation**
```bash
# Ubuntu
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
```

**2. Security**
```bash
# Create admin user
mongosh
use admin
db.createUser({
  user: "admin",
  pwd: "strong-password",
  roles: ["userAdminAnyDatabase", "dbAdminAnyDatabase", "readWriteAnyDatabase"]
})

# Enable authentication
sudo nano /etc/mongod.conf
# Add:
# security:
#   authorization: enabled

sudo systemctl restart mongod
```

**3. Backup Strategy**
```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
mongodump --uri="mongodb://localhost:27017/echolink" --out="/backups/echolink_$DATE"
find /backups -name "echolink_*" -mtime +7 -exec rm -rf {} \;

# Add to crontab
crontab -e
# Add: 0 2 * * * /path/to/backup.sh
```

---

## 🔧 Production Optimizations

### PM2 Configuration

Create `ecosystem.config.js` in backend:
```javascript
module.exports = {
  apps: [{
    name: 'echolink-backend',
    script: './server.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    max_memory_restart: '1G',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
```

Start with: `pm2 start ecosystem.config.js`

### Memory Optimization for Embedding Service

Update `embed_service/app.py`:
```python
# Add memory limits
import resource
resource.setrlimit(resource.RLIMIT_AS, (2 * 1024 * 1024 * 1024, -1))  # 2GB limit
```

---

## 📊 Monitoring

### Health Checks

```bash
# Backend
curl http://localhost:3001/health

# Embedding service
curl http://localhost:5000/health

# Frontend
curl http://localhost:3000/health
```

### PM2 Monitoring
```bash
pm2 monit
pm2 logs
pm2 status
```

### Docker Monitoring
```bash
docker stats
docker-compose logs -f --tail=100
```

---

## 🔒 Security Checklist

- [ ] Environment variables secured (not in code)
- [ ] JWT secret is strong (256-bit minimum)
- [ ] HTTPS enabled with valid certificate
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] MongoDB authentication enabled
- [ ] Firewall configured (UFW or security groups)
- [ ] Regular backups scheduled
- [ ] Monitoring and alerts configured
- [ ] Security headers configured

---

## 🚨 Troubleshooting

### Container won't start
```bash
docker-compose logs <service-name>
docker-compose down && docker-compose up -d --build
```

### MongoDB connection issues
- Check network access in Atlas
- Verify connection string
- Check firewall rules

### Frontend can't reach backend
- Verify `VITE_API_URL` in frontend
- Check CORS configuration in backend
- Verify reverse proxy config

### Embedding service out of memory
- Increase Docker memory limit
- Use smaller batch size
- Scale horizontally

---

## 📞 Support

For deployment issues:
1. Check logs: `docker-compose logs` or `pm2 logs`
2. Verify environment variables
3. Review health check endpoints
4. Consult platform-specific docs

---

**Next Steps:** After deployment, run the E2E tests against your production URL to verify everything works!
