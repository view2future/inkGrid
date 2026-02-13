# inkGrid - Ancient Stele Character Recognition System

A comprehensive system for recognizing and analyzing characters in ancient Chinese steles (stone inscriptions).

## Features

- 🏛️ **Ancient Stele OCR**: Specialized OCR for seal script (篆书) and other ancient scripts
- 📊 **Character Extraction**: Precise extraction of individual characters with proper naming
- 🎯 **Layout Analysis**: Traditional Chinese reading order (right-to-left, top-to-bottom)
- 🧠 **Hybrid Approach**: Combines computer vision with domain knowledge

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
└── scripts/          # Utility scripts
```

## License

MIT License