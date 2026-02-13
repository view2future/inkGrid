# inkGrid - Ancient Stele Character Recognition System

A comprehensive system for recognizing and analyzing characters in ancient Chinese steles (stone inscriptions).

## Features

- 🏛️ **Ancient Stele Display**: Beautiful visualization of seal script (篆书) and other ancient scripts
- 📊 **Character Gallery**: Precise display of individual characters with proper naming
- 🎯 **Layout Analysis**: Traditional Chinese reading order (right-to-left, top-to-bottom)
- 🧠 **Cultural Heritage**: Preserving and showcasing traditional Chinese calligraphy

## Deployment

### Deploy to Zeabur

This project is ready for deployment on [Zeabur](https://zeabur.com) with Docker support.

1. Push your code to a Git repository (GitHub, GitLab, etc.)
2. Create a new service in Zeabur
3. Connect to your Git repository
4. Select "Docker" as the deployment method
5. Use the default `Dockerfile`
6. Set the health check path to `/health`
7. Deploy!

The application will be accessible on the port assigned by Zeabur, with automatic support for the `$PORT` environment variable.

**Note**: The Docker image includes all necessary system dependencies for the frontend display functionality.

## Key Components

- `frontend/`: Modern web interface with React and TypeScript
- `backend/`: API services for the frontend
- `steles/`: Collection of stele images including Yishan, Yan Qinli, Cao Quan, etc.
- `Dockerfile`: Docker configuration for Zeabur deployment
- `docker-start.sh`: Container startup script

## Features Available

- **墨廊 (Gallery)**: Browse through various ancient steles
- **峄山刻石 (Yishan Stele)**: Detailed view of the famous Yishan stone inscription
- **墨流 (Ink Flow)**: Interactive character learning experience
- **首页 (Home)**: Main dashboard with featured content

## Project Structure

```
├── steles/           # Stele image collections
├── frontend/         # Web interface (React + TypeScript)
├── backend/          # API services
├── Dockerfile        # Docker configuration for Zeabur deployment
├── docker-start.sh   # Container startup script
└── scripts/          # Utility scripts
```

## License

MIT License