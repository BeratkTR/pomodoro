#!/bin/bash

echo "🚀 Starting deployment..."

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main

# Install/update server dependencies
echo "📦 Installing server dependencies..."
cd server
npm install --production

# Install/update client dependencies and build
echo "📦 Building client..."
cd ../client
npm install
npm run build

# Go back to root directory
cd ..

# Restart the application
echo "🔄 Restarting application..."
pm2 restart pomodoro-app

# Show status
echo "📊 Application status:"
pm2 status

echo "✅ Deployment complete!"
echo "🌐 App should be available at: http://$(curl -s ifconfig.me):5001" 