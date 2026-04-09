"""Audio mixing service for podcast generation."""

import os
import re
from pathlib import Path
from typing import List, Tuple, Optional

# Set ffmpeg path for pydub
os.environ['PATH'] = os.path.expanduser('~/.local/bin') + ':' + os.environ.get('PATH', '')

from pydub import AudioSegment

# Set pydub ffmpeg converter
AudioSegment.converter = os.path.expanduser('~/.local/bin/ffmpeg')
AudioSegment.ffmpeg = os.path.expanduser('~/.local/bin/ffmpeg')
AudioSegment.ffprobe = os.path.expanduser('~/.local/bin/ffprobe')

# Music file mapping
MUSIC_DIR = "/workspaces/autogen-newsroom/ai-newsroom/audio"

MUSIC_MAPPING = {
    'orch_a': {
        'intro': 'intro_orch_a.mp3',
        'outro': 'outro_orch_a.mp3',
        'story_sting': 'story_orch_a.mp3',
        'block_sting': 'block_orch_a.mp3'
    },
    'modern_b': {
        'intro': 'intro_modern_b.mp3',
        'outro': 'outro_modern_b.mp3',
        'story_sting': 'story_modern_b.mp3',
        'block_sting': 'block_modern_b.mp3'
    },
    'nordic_c': {
        'intro': 'intro_nordic_c.mp3',
        'outro': 'outro_nordic_c.mp3',
        'story_sting': 'story_nordic_c.mp3',
        'block_sting': 'block_nordic_c.mp3'
    },
    'bbc_d': {
        'intro': 'intro_bbc_d.mp3',
        'outro': 'outro_bbc_d.mp3',
        'story_sting': 'story_bbc_d.mp3',
        'block_sting': 'block_bbc_d.mp3'
    },
    'contemp_e': {
        'intro': 'intro_contemp_e.mp3',
        'outro': 'outro_contemp_e.mp3',
        'story_sting': 'story_contemp_e.mp3',
        'block_sting': 'block_contemp_e.mp3'
    }
}


class AudioMixer:
    """Service for mixing podcast audio with music."""
    
    def __init__(self, music_dir: str = None):
        """Initialize audio mixer.
        
        Args:
            music_dir: Directory containing music files
        """
        self.music_dir = music_dir or MUSIC_DIR
    
    def _get_music_path(self, music_style: str, music_type: str) -> Optional[str]:
        """Get path to music file.
        
        Args:
            music_style: Music style ID (orch_a, modern_b, etc.)
            music_type: Type of music (intro, outro, story_sting, block_sting)
            
        Returns:
            Path to music file or None if not found
        """
        style_mapping = MUSIC_MAPPING.get(music_style, MUSIC_MAPPING['orch_a'])
        filename = style_mapping.get(music_type)
        
        if filename:
            path = os.path.join(self.music_dir, filename)
            if os.path.exists(path):
                return path
        
        return None
    
    def _split_script_into_segments(self, script: str) -> List[Tuple[str, str]]:
        """Split script into segments with type labels.
        
        Returns:
            List of (segment_type, text) tuples
        """
        segments = []
        
        # Split by music cues
        # Pattern: [MUSIC CUE] or [STORY STING] etc.
        parts = re.split(r'(\[.*?\])', script)
        
        current_type = 'intro'
        current_text = []
        
        for part in parts:
            part = part.strip()
            if not part:
                continue
            
            if part.startswith('[') and part.endswith(']'):
                # Save current segment
                if current_text:
                    segments.append((current_type, ' '.join(current_text)))
                    current_text = []
                
                # Determine next segment type based on cue
                cue = part.lower()
                if 'intro' in cue:
                    current_type = 'intro'
                elif 'outro' in cue:
                    current_type = 'outro'
                elif 'story' in cue or 'sting' in cue:
                    current_type = 'sting'
                elif 'block' in cue:
                    current_type = 'block'
                else:
                    current_type = 'content'
            else:
                current_text.append(part)
        
        # Don't forget last segment
        if current_text:
            segments.append((current_type, ' '.join(current_text)))
        
        return segments
    
    def mix_podcast(
        self,
        speech_segments: List[AudioSegment],
        music_style: str,
        output_path: str,
        fade_in_ms: int = 500,
        fade_out_ms: int = 1000
    ) -> bool:
        """Mix speech segments with music.
        
        Args:
            speech_segments: List of audio segments for each part
            music_style: Music style to use
            output_path: Where to save the final mix
            fade_in_ms: Fade in duration in milliseconds
            fade_out_ms: Fade out duration in milliseconds
            
        Returns:
            True if successful
        """
        try:
            print(f"[AudioMixer] Mixing podcast with style {music_style}...")
            
            # Load music files
            intro_music_path = self._get_music_path(music_style, 'intro')
            outro_music_path = self._get_music_path(music_style, 'outro')
            sting_music_path = self._get_music_path(music_style, 'story_sting')
            
            # Build final audio
            final_audio = AudioSegment.empty()
            
            # Add intro music
            if intro_music_path and os.path.exists(intro_music_path):
                print(f"[AudioMixer] Adding intro music...")
                intro = AudioSegment.from_mp3(intro_music_path)
                final_audio += intro
            
            # Add speech segments with stings between stories
            for i, segment in enumerate(speech_segments):
                # Add speech
                final_audio += segment
                
                # Add sting between segments (but not after last)
                if i < len(speech_segments) - 1 and sting_music_path:
                    if os.path.exists(sting_music_path):
                        sting = AudioSegment.from_mp3(sting_music_path)
                        final_audio += sting
            
            # Add outro music
            if outro_music_path and os.path.exists(outro_music_path):
                print(f"[AudioMixer] Adding outro music...")
                outro = AudioSegment.from_mp3(outro_music_path)
                final_audio += outro
            
            # Apply fade in/out
            final_audio = final_audio.fade_in(fade_in_ms).fade_out(fade_out_ms)
            
            # Export
            print(f"[AudioMixer] Exporting to {output_path}...")
            final_audio.export(output_path, format='mp3', bitrate='192k')
            
            print(f"[AudioMixer] Podcast mix complete: {output_path}")
            return True
            
        except Exception as e:
            print(f"[AudioMixer] Error mixing podcast: {e}")
            return False
    
    def get_music_preview_path(self, music_style: str, music_type: str) -> Optional[str]:
        """Get path to a music file for preview.
        
        Args:
            music_style: Music style ID
            music_type: Type of music (intro, outro, story_sting, block_sting)
            
        Returns:
            Path to music file or None
        """
        return self._get_music_path(music_style, music_type)


# Global instance
_audio_mixer = None


def get_audio_mixer() -> AudioMixer:
    """Get or create the global audio mixer instance."""
    global _audio_mixer
    if _audio_mixer is None:
        _audio_mixer = AudioMixer()
    return _audio_mixer


if __name__ == "__main__":
    # Test the mixer
    print("Testing Audio Mixer...")
    mixer = get_audio_mixer()
    
    # Check music files
    for style in MUSIC_MAPPING.keys():
        intro = mixer.get_music_preview_path(style, 'intro')
        print(f"  {style}: intro={'✅' if intro else '❌'}")
