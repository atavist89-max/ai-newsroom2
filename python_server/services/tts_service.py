"""Text-to-Speech Service using Piper TTS."""

import os
import json
import urllib.request
from pathlib import Path
from typing import Optional, Dict
import subprocess
import tempfile

# Voice mapping from app voices to Piper voice models
VOICE_MAPPING = {
    'adam': {
        'model': 'en_US-lessac-medium',
        'url': 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx',
        'config_url': 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json'
    },
    'bella': {
        'model': 'en_US-amy-medium',
        'url': 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/amy/medium/en_US-amy-medium.onnx',
        'config_url': 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/amy/medium/en_US-amy-medium.onnx.json'
    },
    'josh': {
        'model': 'en_GB-alan-medium',
        'url': 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/alan/medium/en_GB-alan-medium.onnx',
        'config_url': 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/alan/medium/en_GB-alan-medium.onnx.json'
    },
    'rachel': {
        'model': 'en_US-libritts-high',
        'url': 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/libritts/high/en_US-libritts-high.onnx',
        'config_url': 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/libritts/high/en_US-libritts-high.onnx.json'
    }
}


class TTSService:
    """Service for text-to-speech generation using Piper."""
    
    def __init__(self, models_dir: str = None):
        """Initialize TTS service.
        
        Args:
            models_dir: Directory to store voice models. Defaults to python_server/models/piper
        """
        if models_dir is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            self.models_dir = os.path.join(base_dir, 'models', 'piper')
        else:
            self.models_dir = models_dir
        
        os.makedirs(self.models_dir, exist_ok=True)
        self._downloaded_models = {}
    
    def _get_model_path(self, voice_id: str) -> tuple[str, str]:
        """Get paths to model and config files.
        
        Returns:
            Tuple of (model_path, config_path)
        """
        voice_info = VOICE_MAPPING.get(voice_id, VOICE_MAPPING['adam'])
        model_name = voice_info['model']
        
        model_path = os.path.join(self.models_dir, f"{model_name}.onnx")
        config_path = os.path.join(self.models_dir, f"{model_name}.onnx.json")
        
        return model_path, config_path
    
    def _download_voice(self, voice_id: str) -> bool:
        """Download voice model if not exists.
        
        Args:
            voice_id: Voice identifier (adam, bella, josh, rachel)
            
        Returns:
            True if successful, False otherwise
        """
        if voice_id not in VOICE_MAPPING:
            print(f"[TTS] Unknown voice: {voice_id}, using adam")
            voice_id = 'adam'
        
        voice_info = VOICE_MAPPING[voice_id]
        model_path, config_path = self._get_model_path(voice_id)
        
        # Check if already downloaded
        if os.path.exists(model_path) and os.path.exists(config_path):
            print(f"[TTS] Voice {voice_id} already downloaded")
            return True
        
        try:
            print(f"[TTS] Downloading voice model for {voice_id}...")
            
            # Download model
            if not os.path.exists(model_path):
                print(f"[TTS] Downloading model from {voice_info['url']}...")
                urllib.request.urlretrieve(voice_info['url'], model_path)
                print(f"[TTS] Model downloaded to {model_path}")
            
            # Download config
            if not os.path.exists(config_path):
                print(f"[TTS] Downloading config from {voice_info['config_url']}...")
                urllib.request.urlretrieve(voice_info['config_url'], config_path)
                print(f"[TTS] Config downloaded to {config_path}")
            
            return True
            
        except Exception as e:
            print(f"[TTS] Error downloading voice {voice_id}: {e}")
            return False
    
    def generate_speech(self, text: str, voice_id: str, output_path: str) -> bool:
        """Generate speech from text using Piper TTS.
        
        Args:
            text: Text to convert to speech
            voice_id: Voice to use (adam, bella, josh, rachel)
            output_path: Path to save the generated audio file
            
        Returns:
            True if successful, False otherwise
        """
        # Download voice if needed
        if not self._download_voice(voice_id):
            print(f"[TTS] Failed to download voice {voice_id}")
            return False
        
        model_path, config_path = self._get_model_path(voice_id)
        
        try:
            print(f"[TTS] Generating speech with voice {voice_id}...")
            
            # Use piper-tts command line
            cmd = [
                'piper',
                '--model', model_path,
                '--config', config_path,
                '--output_file', output_path
            ]
            
            # Run piper with text input
            process = subprocess.run(
                cmd,
                input=text.encode('utf-8'),
                capture_output=True,
                timeout=60
            )
            
            if process.returncode == 0 and os.path.exists(output_path):
                print(f"[TTS] Speech generated: {output_path}")
                return True
            else:
                print(f"[TTS] Piper error: {process.stderr.decode()}")
                return False
                
        except subprocess.TimeoutExpired:
            print(f"[TTS] Generation timeout")
            return False
        except Exception as e:
            print(f"[TTS] Error generating speech: {e}")
            return False
    
    def generate_sample(self, voice_id: str, output_dir: str) -> bool:
        """Generate sample audio for a voice.
        
        Args:
            voice_id: Voice to use
            output_dir: Directory to save the sample
            
        Returns:
            True if successful, False otherwise
        """
        sample_text = "Welcome to AI Newsroom. This is a preview of my voice for your news podcast."
        output_path = os.path.join(output_dir, f"{voice_id}.mp3")
        return self.generate_speech(sample_text, voice_id, output_path)
    
    def generate_samples_for_all_voices(self, output_dir: str) -> Dict[str, bool]:
        """Generate samples for all voices.
        
        Args:
            output_dir: Directory to save samples
            
        Returns:
            Dictionary mapping voice_id to success status
        """
        os.makedirs(output_dir, exist_ok=True)
        results = {}
        
        for voice_id in VOICE_MAPPING.keys():
            print(f"[TTS] Generating sample for {voice_id}...")
            results[voice_id] = self.generate_sample(voice_id, output_dir)
        
        return results


# Global instance
_tts_service = None


def get_tts_service() -> TTSService:
    """Get or create the global TTS service instance."""
    global _tts_service
    if _tts_service is None:
        _tts_service = TTSService()
    return _tts_service


if __name__ == "__main__":
    # Test the service
    print("Testing TTS Service...")
    tts = get_tts_service()
    
    # Generate samples
    output_dir = "/workspaces/autogen-newsroom/ai-newsroom/audio/voices"
    results = tts.generate_samples_for_all_voices(output_dir)
    
    print("\nResults:")
    for voice_id, success in results.items():
        status = "✅" if success else "❌"
        print(f"  {status} {voice_id}")
