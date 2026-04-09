"""Podcast audio generator - combines TTS and audio mixing."""

import os
import sys

# Set ffmpeg path for pydub
os.environ['PATH'] = os.path.expanduser('~/.local/bin') + ':' + os.environ.get('PATH', '')

import re
from typing import Optional
from pydub import AudioSegment

# Set pydub paths
AudioSegment.converter = os.path.expanduser('~/.local/bin/ffmpeg')
AudioSegment.ffmpeg = os.path.expanduser('~/.local/bin/ffmpeg')
AudioSegment.ffprobe = os.path.expanduser('~/.local/bin/ffprobe')

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.tts_service import get_tts_service, VOICE_MAPPING
from services.audio_mixer import get_audio_mixer, MUSIC_MAPPING


class PodcastAudioGenerator:
    """Generates complete podcast audio with speech and music."""
    
    def __init__(self):
        """Initialize the generator."""
        self.tts = get_tts_service()
        self.mixer = get_audio_mixer()
    
    def _extract_story_segments(self, script: str) -> list:
        """Extract story segments from script.
        
        Returns:
            List of (segment_name, text) tuples
        """
        segments = []
        
        # Split script into major sections
        # Look for patterns like "Story 1:", "Story 2:", etc.
        lines = script.split('\n')
        current_segment = "intro"
        current_text = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Check for section headers
            lower_line = line.lower()
            if 'intro' in lower_line and ':' in line:
                if current_text:
                    segments.append((current_segment, '\n'.join(current_text)))
                current_segment = "intro"
                current_text = [line]
            elif any(x in lower_line for x in ['story 1', 'story 2', 'story 3', 'story 4', 'story 5']):
                if current_text:
                    segments.append((current_segment, '\n'.join(current_text)))
                # Extract story number
                match = re.search(r'story\s*(\d+)', lower_line)
                if match:
                    current_segment = f"story_{match.group(1)}"
                else:
                    current_segment = f"story_{len(segments)}"
                current_text = [line]
            elif 'outro' in lower_line:
                if current_text:
                    segments.append((current_segment, '\n'.join(current_text)))
                current_segment = "outro"
                current_text = [line]
            else:
                current_text.append(line)
        
        # Don't forget last segment
        if current_text:
            segments.append((current_segment, '\n'.join(current_text)))
        
        return segments
    
    def generate_podcast_audio(
        self,
        script: str,
        voice_id: str,
        music_style: str,
        output_path: str,
        temp_dir: str = None
    ) -> bool:
        """Generate complete podcast audio.
        
        Args:
            script: The podcast script text
            voice_id: Voice to use (adam, bella, josh, rachel)
            music_style: Music style (orch_a, modern_b, etc.)
            output_path: Where to save the final MP3
            temp_dir: Directory for temporary files
            
        Returns:
            True if successful
        """
        try:
            print(f"[PodcastAudio] Starting generation...")
            print(f"[PodcastAudio] Voice: {voice_id}, Music: {music_style}")
            
            # Validate voice
            if voice_id not in VOICE_MAPPING:
                print(f"[PodcastAudio] Unknown voice {voice_id}, using adam")
                voice_id = 'adam'
            
            # Create temp directory
            if temp_dir is None:
                temp_dir = os.path.join(os.path.dirname(output_path), '.temp')
            os.makedirs(temp_dir, exist_ok=True)
            
            # Extract segments
            segments = self._extract_story_segments(script)
            print(f"[PodcastAudio] Found {len(segments)} segments")
            
            # Generate speech for each segment
            speech_segments = []
            for i, (seg_name, text) in enumerate(segments):
                print(f"[PodcastAudio] Generating speech for {seg_name}...")
                
                temp_path = os.path.join(temp_dir, f"segment_{i}.wav")
                
                if self.tts.generate_speech(text, voice_id, temp_path):
                    # Load the audio segment
                    segment_audio = AudioSegment.from_wav(temp_path)
                    speech_segments.append(segment_audio)
                    print(f"[PodcastAudio]  ✓ {seg_name}: {len(segment_audio)}ms")
                else:
                    print(f"[PodcastAudio]  ✗ Failed to generate {seg_name}")
                    return False
            
            if not speech_segments:
                print("[PodcastAudio] No speech segments generated!")
                return False
            
            # Mix with music
            print(f"[PodcastAudio] Mixing {len(speech_segments)} segments with music...")
            success = self.mixer.mix_podcast(
                speech_segments=speech_segments,
                music_style=music_style,
                output_path=output_path
            )
            
            # Cleanup temp files
            for i in range(len(segments)):
                temp_path = os.path.join(temp_dir, f"segment_{i}.wav")
                if os.path.exists(temp_path):
                    os.remove(temp_path)
            
            if success:
                print(f"[PodcastAudio] ✅ Podcast audio generated: {output_path}")
                # Get file size
                size_mb = os.path.getsize(output_path) / (1024 * 1024)
                print(f"[PodcastAudio] File size: {size_mb:.2f} MB")
            
            return success
            
        except Exception as e:
            print(f"[PodcastAudio] Error generating podcast: {e}")
            import traceback
            traceback.print_exc()
            return False


# Global instance
_generator = None


def get_podcast_audio_generator() -> PodcastAudioGenerator:
    """Get or create the global generator instance."""
    global _generator
    if _generator is None:
        _generator = PodcastAudioGenerator()
    return _generator


def generate_podcast_audio(
    script: str,
    voice_id: str,
    music_style: str,
    output_path: str
) -> bool:
    """Convenience function to generate podcast audio.
    
    Args:
        script: Podcast script
        voice_id: Voice ID
        music_style: Music style
        output_path: Output path
        
    Returns:
        True if successful
    """
    generator = get_podcast_audio_generator()
    return generator.generate_podcast_audio(script, voice_id, music_style, output_path)


if __name__ == "__main__":
    # Test the generator
    print("Testing Podcast Audio Generator...")
    
    test_script = """
Welcome to AI Newsroom Daily Briefing for April 9th, 2026.

Story 1: UK Economy Shows Signs of Growth
The UK economy has shown promising growth this quarter.

Story 2: Technology Breakthrough
Scientists have made a major breakthrough in renewable energy.

That's all for today's briefing. Thank you for listening.
"""
    
    output = "/workspaces/autogen-newsroom/output/test_podcast.mp3"
    success = generate_podcast_audio(test_script, 'adam', 'orch_a', output)
    
    if success:
        print(f"✅ Test podcast generated: {output}")
    else:
        print("❌ Test failed")
