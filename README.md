# inkGrid - Ancient Stele Character Recognition System

A comprehensive system for recognizing and analyzing characters in ancient Chinese steles (stone inscriptions).

## Features

- 🏛️ **Ancient Stele OCR**: Specialized OCR for seal script (篆书) and other ancient scripts
- 📊 **Character Extraction**: Precise extraction of individual characters with proper naming
- 🎯 **Layout Analysis**: Traditional Chinese reading order (right-to-left, top-to-bottom)
- 🧠 **Hybrid Approach**: Combines computer vision with domain knowledge

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

**Note**: The Docker image includes all necessary system dependencies for OpenCV and OCR functionality.

## Key Components

- `final_yishan_ocr.py`: Final OCR system for Yishan Stele with proper naming
- `accurate_stele_detector.py`: Accurate position detection without false identification
- `seal_script_analyzer.py`: Advanced analysis for seal script characters
- `processor/`: Core processing modules
- `steles/`: Collection of stele images including Yishan, Yan Qinli, Cao Quan, etc.

## Usage

```bash
python3 final_yishan_ocr.py --image_path steles/1-zhuanshu/1-yishankeshi/yishan.jpg --output_dir output/
```

## Project Structure

```
├── steles/           # Stele image collections
├── processor/        # Core processing modules
├── library_guided_export/  # Export templates
├── frontend/         # Web interface
├── backend/          # API services
├── Dockerfile        # Docker configuration for Zeabur deployment
├── docker-start.sh   # Container startup script
└── scripts/          # Utility scripts
```

## License

MIT License