import sys
import os
import json
import asyncio
import subprocess
import edge_tts
from google import genai


def update_status(output_dir, status, progress, message):
    status_path = os.path.join(output_dir, "status.json")
    with open(status_path, "w") as f:
        json.dump({"status": status, "progress": progress, "message": message}, f)


async def generate_audio(text, output_path):
    communicate = edge_tts.Communicate(text, "en-US-AriaNeural")
    await communicate.save(output_path)


def get_audio_duration(audio_path):
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            audio_path,
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        return float(result.stdout.strip())
    except ValueError:
        return 3.0


def smart_indent(code_str, target_spaces=8):
    lines = code_str.splitlines()
    non_empty = [len(l) - len(l.lstrip()) for l in lines if l.strip()]
    base_indent = min(non_empty) if non_empty else 0

    indented_lines = []
    for line in lines:
        if not line.strip():
            indented_lines.append("")
        else:
            current_indent = len(line) - len(line.lstrip())
            relative_indent = max(0, current_indent - base_indent)
            indented_lines.append(
                " " * (target_spaces + relative_indent) + line.lstrip()
            )
    return "\n".join(indented_lines)


def heal_code_with_gemini(broken_code, error_traceback):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return broken_code

    client = genai.Client(apiKey=api_key, http_options={"api_version": "v1beta"})
    prompt = f"""You are an expert Manim (Python Community Edition) developer. 
The following Manim code failed to render and threw an error. Fix the code so it executes successfully.
CRITICAL RULES:
- Use 3D coordinates like ORIGIN + UP * 2.5 to avoid shape broadcasting errors.
- Never use Tex or MathTex. Use only standard Text("...").
- NEVER index into self.mobjects (e.g., self.mobjects[0]). Always assign your shapes and text to explicit local variables and animate those variables directly.
- NEVER pass multiple separate objects into FadeOut like FadeOut(a, b, c). Wrap them in a VGroup or fade them out individually.
- Keep it inside def construct(self): indented correctly.

BROKEN CODE:
{broken_code}

ERROR TRACEBACK:
{error_traceback}

Return ONLY the corrected Python code block inside standard markdown backticks."""

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash", contents=[prompt]
        )
        text = response.text or ""
        if "```python" in text:
            text = text.split("```python")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        return text.strip()
    except Exception:
        return broken_code


def main():
    if len(sys.argv) < 2:
        print("Error: Output directory missing.")
        sys.exit(1)

    output_dir = sys.argv[1]
    json_path = os.path.join(output_dir, "lesson.json")

    if not os.path.exists(json_path):
        print(f"Error: {json_path} not found.")
        sys.exit(1)

    with open(json_path, "r") as f:
        data = json.load(f)

    update_status(
        output_dir,
        "generating",
        35,
        "Synthesizing voiceover narration with edge-tts...",
    )

    # 1. Generate Audio & measure duration for each scene
    audio_files = []
    for i, scene in enumerate(data["scenes"]):
        audio_path = os.path.join(output_dir, f"scene_{i}.mp3")
        asyncio.run(generate_audio(scene["narration"], audio_path))
        duration = get_audio_duration(audio_path)
        audio_files.append((audio_path, duration))
        scene["duration"] = duration

    # Save durations back to lesson.json
    with open(json_path, "w") as f:
        json.dump(data, f, indent=2)

    update_status(
        output_dir, "generating", 60, "Assembling Manim blackboard animation script..."
    )

    max_retries = 2
    success = False
    manim_script_path = os.path.join(output_dir, "generated_scene.py")

    for attempt in range(max_retries + 1):
        manim_methods = []
        for i, scene in enumerate(data["scenes"]):
            duration = audio_files[i][1]
            code = scene["manim_code"]

            # If retrying and an error was recorded, heal it and PERSIST the fix!
            if attempt > 0 and scene.get("last_error"):
                print(f"Healing scene {i+1} with Gemini (Attempt {attempt+1})...")
                code = heal_code_with_gemini(code, scene["last_error"])
                scene["manim_code"] = (
                    code  # Persist healed code for subsequent attempts
                )

            # Sanitize common AI mistakes
            code = code.replace(
                "FadeOut(self.mobjects)", "FadeOut(Group(*self.mobjects))"
            )
            code = code.replace("FadeOut(mobjects)", "FadeOut(Group(*self.mobjects))")

            formatted_code = smart_indent(code, target_spaces=8)
            scene_block = f"""
        # --- Scene {i+1} ---
{formatted_code}
        self.wait({max(1.0, duration - 0.5)})
        if self.mobjects:
            self.play(FadeOut(Group(*self.mobjects)), run_time=0.5)
        """

            manim_methods.append(scene_block)

        all_scenes_code = "\n".join(manim_methods)
        manim_code = f"""
from manim import *

config.preview = False

class BlackboardLesson(Scene):
    def construct(self):
        self.camera.background_color = "#1e1e1e"
{all_scenes_code}
"""
        with open(manim_script_path, "w") as f:
            f.write(manim_code)

        update_status(
            output_dir,
            "generating",
            75,
            f"Rendering vector animations (Attempt {attempt+1})...",
        )

        log_path = os.path.join(output_dir, "manim_debug.log")
        try:
            print(f"Starting Manim render for {manim_script_path}...")
            with open(log_path, "w") as log_file:
                result = subprocess.run(
                    [
                        "manim",
                        "-ql",
                        "--media_dir",
                        output_dir,
                        manim_script_path,
                        "BlackboardLesson",
                    ],
                    stdout=log_file,
                    stderr=subprocess.STDOUT,
                    check=True,
                    timeout=120,
                )
            success = True
            break
        except subprocess.TimeoutExpired:
            err = "Manim rendering timed out after 120 seconds."
            for scene in data["scenes"]:
                scene["last_error"] = err
            if attempt == max_retries:
                update_status(output_dir, "failed", 100, err)
                sys.exit(1)
        except subprocess.CalledProcessError as e:
            with open(log_path, "r") as log_file:
                err_content = log_file.read()

            error_msg = (
                err_content[-600:] if err_content else "Manim exited with an error."
            )
            print(f"\n[Attempt {attempt+1} Failed]:\n{error_msg}\n")

            # Attach error to all scenes so healing targets them
            for scene in data["scenes"]:
                scene["last_error"] = error_msg

            if attempt == max_retries:
                update_status(
                    output_dir, "failed", 100, "Manim render error after retries."
                )
                sys.exit(1)

    if not success:
        sys.exit(1)

    update_status(
        output_dir, "generating", 90, "Merging audio and video tracks with FFmpeg..."
    )

    rendered_video = None
    for root, dirs, files in os.walk(output_dir):
        for file in files:
            if file.endswith(".mp4") and "BlackboardLesson" in file:
                rendered_video = os.path.join(root, file)
                break
        if rendered_video:
            break

    if not rendered_video:
        update_status(
            output_dir, "failed", 100, "Rendered video file could not be located."
        )
        sys.exit(1)

    concat_list_path = os.path.join(output_dir, "concat.txt")
    with open(concat_list_path, "w") as f:
        for audio_path, _ in audio_files:
            f.write(f"file '{audio_path}'\n")

    master_audio_path = os.path.join(output_dir, "master_audio.mp3")
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            concat_list_path,
            "-c",
            "copy",
            master_audio_path,
        ],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    final_video_path = os.path.join(output_dir, "final.mp4")
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            rendered_video,
            "-i",
            master_audio_path,
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-shortest",
            final_video_path,
        ],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    update_status(output_dir, "completed", 100, "Lesson successfully generated!")


if __name__ == "__main__":
    main()
