"""
Pydantic Models for Stele Analysis Results.

Defines the data structures for:
- Individual character metadata
- Stele information
- Complete analysis results
"""

from pydantic import BaseModel, Field
from typing import List, Optional


class SteleCharacter(BaseModel):
    """
    Single character detection result.
    
    Attributes:
        index: Character index in reading order (1-based)
        original_char: Character as written in the stele (Seal/Clerical script)
        simplified_char: Standard simplified Chinese equivalent
        pinyin: Pinyin with tone marks
        definition: Brief definition/explanation
        bbox: Bounding box [ymin, xmin, ymax, xmax] in normalized coordinates [0-1000]
        row: Column number (right-to-left, 1 = rightmost)
        col: Row number (top-to-bottom, 1 = topmost)
    """
    index: int = Field(..., description="Character index in reading order")
    original_char: str = Field(..., description="Character as written in stele")
    simplified_char: str = Field(..., description="Simplified Chinese equivalent")
    pinyin: str = Field(default="", description="Pinyin with tone marks")
    definition: str = Field(default="", description="Brief definition")
    bbox: List[int] = Field(..., description="[ymin, xmin, ymax, xmax] normalized 0-1000")
    row: int = Field(..., description="Column number (right-to-left)")
    col: int = Field(..., description="Row number (top-to-bottom)")


class SteleInfo(BaseModel):
    """
    Metadata about the stele.
    
    Attributes:
        name: Name of the stele
        script_type: Type of script (Seal/Clerical/Regular/etc.)
        layout: Layout direction (Vertical/Horizontal)
        total_characters: Total number of characters
    """
    name: str = Field(..., description="Stele name")
    script_type: str = Field(..., description="Script type: Seal/Clerical/Regular/etc.")
    layout: str = Field(default="Vertical", description="Layout: Vertical or Horizontal")
    total_characters: int = Field(..., description="Total character count")


class SteleAnalysisResult(BaseModel):
    """
    Complete analysis result from VLM.
    
    Attributes:
        stele_info: Metadata about the stele
        characters: List of detected characters
    """
    stele_info: SteleInfo
    characters: List[SteleCharacter]
    
    class Config:
        # Allow extra fields for flexibility
        extra = "ignore"


def scale_to_pixels(normalized_bbox: List[int], img_width: int, img_height: int) -> List[int]:
    """
    Convert normalized bbox [ymin, xmin, ymax, xmax] (0-1000) to pixel coordinates [x, y, w, h].
    
    Args:
        normalized_bbox: [ymin, xmin, ymax, xmax] in range [0, 1000]
        img_width: Image width in pixels
        img_height: Image height in pixels
        
    Returns:
        [x, y, w, h] in pixel coordinates
        
    Example:
        >>> scale_to_pixels([100, 200, 300, 400], 1000, 1000)
        [200, 100, 200, 200]  # x=200, y=100, w=200, h=200
    """
    ymin, xmin, ymax, xmax = normalized_bbox
    
    # Scale to pixels
    px_xmin = int(xmin * img_width / 1000)
    px_ymin = int(ymin * img_height / 1000)
    px_xmax = int(xmax * img_width / 1000)
    px_ymax = int(ymax * img_height / 1000)
    
    # Calculate width and height
    w = px_xmax - px_xmin
    h = px_ymax - px_ymin
    
    return [px_xmin, px_ymin, w, h]


def pixels_to_normalized(pixel_bbox: List[int], img_width: int, img_height: int) -> List[int]:
    """
    Convert pixel coordinates [x, y, w, h] to normalized bbox [ymin, xmin, ymax, xmax] (0-1000).
    
    Args:
        pixel_bbox: [x, y, w, h] in pixel coordinates
        img_width: Image width in pixels
        img_height: Image height in pixels
        
    Returns:
        [ymin, xmin, ymax, xmax] in range [0, 1000]
    """
    x, y, w, h = pixel_bbox
    
    xmin = int(x * 1000 / img_width)
    ymin = int(y * 1000 / img_height)
    xmax = int((x + w) * 1000 / img_width)
    ymax = int((y + h) * 1000 / img_height)
    
    return [ymin, xmin, ymax, xmax]


class CharacterSlice(BaseModel):
    """
    Processed character with pixel coordinates and cropped image reference.
    
    This is used after coordinate conversion and image slicing.
    """
    index: int
    char: str
    original: str
    bbox: List[int]  # [x, y, w, h] pixels
    pinyin: str
    definition: str
    row: int
    col: int
    image_path: Optional[str] = None  # Path to cropped character image
