import os
import sys
import json
from unittest.mock import MagicMock, patch

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from processor.core.inference import run_vlm_analysis

def test_mock_analysis():
    print("=== Running Mock VLM Analysis Test ===")
    
    mock_response = {
        "stele_info": {
            "name": "峄山刻石",
            "script_type": "小篆",
            "layout": "Vertical",
            "total_characters": 4
        },
        "characters": [
            {
                "index": 1,
                "original_char": "皇",
                "simplified_char": "皇",
                "pinyin": "huáng",
                "definition": "皇帝",
                "bbox": [100, 800, 200, 900],
                "row": 1,
                "col": 1
            },
            {
                "index": 2,
                "original_char": "帝",
                "simplified_char": "帝",
                "pinyin": "dì",
                "definition": "帝王",
                "bbox": [210, 800, 310, 900],
                "row": 1,
                "col": 2
            },
            {
                "index": 3,
                "original_char": "立",
                "simplified_char": "立",
                "pinyin": "lì",
                "definition": "建立",
                "bbox": [100, 600, 200, 700],
                "row": 2,
                "col": 1
            },
            {
                "index": 4,
                "original_char": "国",
                "simplified_char": "国",
                "pinyin": "guó",
                "definition": "国家",
                "bbox": [210, 600, 310, 700],
                "row": 2,
                "col": 2
            }
        ]
    }

    with patch('processor.core.inference.get_vlm_client') as mock_get_client:
        mock_client = MagicMock()
        mock_client.analyze_stele.return_value = json.dumps(mock_response)
        mock_get_client.return_value = mock_client
        
        with patch('processor.core.inference.TextVault') as mock_vault:
            mock_vault.return_value.fetch_text.return_value = "皇帝立国"
            
            try:
                result = run_vlm_analysis(
                    image_path="steles/1-zhuanshu/1-yishankeshi/yishan.jpg",
                    stele_name="峄山刻石",
                    script_type="小篆"
                )
                
                print("\nSUCCESS: Pipeline executed correctly with Mock data.")
                chars = result['characters']
                print(f"Reading Order: {' -> '.join([c['char'] for c in chars])}")
                print(f"BBox check: {chars[0]['char']} {chars[0]['bbox']}")
                
            except Exception as e:
                print(f"FAILED: {e}")

if __name__ == "__main__":
    test_mock_analysis()