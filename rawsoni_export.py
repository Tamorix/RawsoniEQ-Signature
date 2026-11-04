
import subprocess
import sys
from pathlib import Path

FFMPEG_PATH = Path(
    r"C:\Users\Tamil G\AppData\Local\CapCut\Apps\9.2.0.3931\ffmpeg.exe"
)


def export_audio(input_wav, output_file, output_format):
    input_path = Path(input_wav)
    output_path = Path(output_file)
    output_format = output_format.lower().strip()

    if not input_path.is_file():
        raise FileNotFoundError(f"Input audio file not found: {input_path}")

    if not FFMPEG_PATH.is_file():
        raise FileNotFoundError(f"FFmpeg not found: {FFMPEG_PATH}")

    if output_format not in ("mp3", "flac"):
        raise ValueError("Supported formats are MP3 and FLAC.")

    if output_path.suffix.lower() != f".{output_format}":
        raise ValueError(f"Output filename must end with .{output_format}")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    command = [
        str(FFMPEG_PATH),
        "-y",
        "-i", str(input_path),
        "-vn",
    ]

    if output_format == "mp3":
        command.extend(["-codec:a", "mp3_mf", "-b:a", "192k"])
    else:
        command.extend(["-codec:a", "flac"])

    command.append(str(output_path))

    subprocess.run(command, check=True)

    if not output_path.is_file() or output_path.stat().st_size == 0:
        raise RuntimeError("Audio export failed: output file is empty.")

    print(f"Export successful: {output_path}")
    print(f"File size: {output_path.stat().st_size:,} bytes")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print('Usage: python rawsoni_export.py "input.wav" "output.mp3" mp3')
        print('Example FLAC: python rawsoni_export.py "input.wav" "output.flac" flac')
        sys.exit(1)

    try:
        export_audio(sys.argv[1], sys.argv[2], sys.argv[3])
    except (
        FileNotFoundError,
        ValueError,
        RuntimeError,
        subprocess.CalledProcessError,
    ) as error:
        print(f"Export error: {error}")
        sys.exit(1)
