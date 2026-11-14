import sys
import os
import json
import asyncio
import subprocess
import edge_tts
from google import genai
import urllib.request
import shutil

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SECRET_KEY")


def update_supabase_status(lesson_id, status, progress, message, video_url=None):
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print(f"[{status.upper()}] {message} (Supabase keys missing)")
        return

    url = f"{SUPABASE_URL}/rest/v1/lessons?id=eq.{lesson_id}"
    payload = {"status": status, "progress": progress, "message": message}
    if video_url:
        payload["video_url"] = video_url

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        method="PATCH",
    )
    try:
        with urllib.request.urlopen(req):
            pass
    except Exception as e:
        print(f"Failed to update Supabase status: {e}")


def fetch_lesson_from_supabase(lesson_id):
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return None, []

    lesson_req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/lessons?id=eq.{lesson_id}&select=*",
        headers={
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        },
    )
    try:
        with urllib.request.urlopen(lesson_req) as resp:
            lessons = json.loads(resp.read().decode("utf-8"))
            lesson = lessons[0] if lessons else None
    except Exception as e:
        print(f"Error fetching lesson: {e}")
        return None, []

    scenes_req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/scenes?lesson_id=eq.{lesson_id}&order=step.asc",
        headers={
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        },
    )
    try:
        with urllib.request.urlopen(scenes_req) as resp:
            scenes = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"Error fetching scenes: {e}")
        scenes = []

    return lesson, scenes


def update_scene_duration_in_supabase(scene_id, duration):
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return
    url = f"{SUPABASE_URL}/rest/v1/scenes?id=eq.{scene_id}"
    data = json.dumps({"duration": duration}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        method="PATCH",
    )
    try:
        with urllib.request.urlopen(req):
            pass
    except Exception:
        pass


def upload_to_supabase_storage(local_file_path, storage_path):
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return None

    url = f"{SUPABASE_URL}/storage/v1/object/lessons/{storage_path}"
    with open(local_file_path, "rb") as f:
        file_data = f.read()

    req = urllib.request.Request(
        url,
        data=file_data,
        headers={
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "video/mp4",
            "x-upsert": "true",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req):
            return f"{SUPABASE_URL}/storage/v1/object/public/lessons/{storage_path}"
    except Exception as e:
        print(f"Storage upload failed: {e}")
        return None


async def generate_audio(text, output_path):
    try:
        communicate = edge_tts.Communicate(text, "en-US-AriaNeural")
        # Run with a 15-second timeout per scene
        await asyncio.wait_for(communicate.save(output_path), timeout=15.0)
    except Exception as e:
        print(
            f"[Warning] edge_tts failed for text segment: {e}. Falling back to silent duration."
        )
        # Fallback: create a silent mp3 using ffmpeg if edge_tts fails or times out
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-f",
                "lavfi",
                "-i",
                "anullsrc=r=44100:cl=mono",
                "-t",
                "5",
                output_path,
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )


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

    client = genai.Client(api_key=api_key, http_options={"api_version": "v1beta"})
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
    if len(sys.argv) < 3:
        print("Error: Lesson ID or User ID missing.")
        sys.exit(1)

    lesson_id = sys.argv[1]
    user_id = sys.argv[2]

    temp_dir = os.path.join(os.getcwd(), "tmp", lesson_id)
    os.makedirs(temp_dir, exist_ok=True)

    try:
        lesson, scenes = fetch_lesson_from_supabase(lesson_id)
        if not lesson or not scenes:
            err_msg = f"Lesson {lesson_id} not found in Supabase."
            print(f"Error: {err_msg}")
            update_supabase_status(lesson_id, "failed", 100, err_msg)
            sys.exit(1)

        update_supabase_status(
            lesson_id,
            "generating",
            35,
            "Synthesizing voiceover narration with edge-tts...",
        )

        audio_files = []
        for i, scene in enumerate(scenes):
            audio_path = os.path.join(temp_dir, f"scene_{i}.mp3")
            asyncio.run(generate_audio(scene["narration"], audio_path))
            duration = get_audio_duration(audio_path)
            audio_files.append((audio_path, duration))
            scene["duration"] = duration
            update_scene_duration_in_supabase(scene["id"], duration)

        update_supabase_status(
            lesson_id,
            "generating",
            60,
            "Assembling Manim blackboard animation script...",
        )

        max_retries = 2
        success = False
        manim_script_path = os.path.join(temp_dir, "generated_scene.py")

        for attempt in range(max_retries + 1):
            manim_methods = []
            for i, scene in enumerate(scenes):
                duration = audio_files[i][1]
                code = scene["manim_code"]

                if attempt > 0 and scene.get("last_error"):
                    print(f"Healing scene {i+1} with Gemini (Attempt {attempt+1})...")
                    code = heal_code_with_gemini(code, scene["last_error"])
                    scene["manim_code"] = code

                code = code.replace(
                    "FadeOut(self.mobjects)", "FadeOut(Group(*self.mobjects))"
                )
                code = code.replace(
                    "FadeOut(mobjects)", "FadeOut(Group(*self.mobjects))"
                )

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

            update_supabase_status(
                lesson_id,
                "generating",
                75,
                f"Rendering vector animations (Attempt {attempt+1})...",
            )

            log_path = os.path.join(temp_dir, "manim_debug.log")
            try:
                with open(log_path, "w") as log_file:
                    subprocess.run(
                        [
                            "manim",
                            "-ql",
                            "--media_dir",
                            temp_dir,
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
                for scene in scenes:
                    scene["last_error"] = err
                if attempt == max_retries:
                    update_supabase_status(lesson_id, "failed", 100, err)
                    sys.exit(1)
            except subprocess.CalledProcessError:
                with open(log_path, "r") as log_file:
                    err_content = log_file.read()

                error_msg = (
                    err_content[-600:] if err_content else "Manim exited with an error."
                )
                for scene in scenes:
                    scene["last_error"] = error_msg

                if attempt == max_retries:
                    update_supabase_status(
                        lesson_id, "failed", 100, "Manim render error after retries."
                    )
                    sys.exit(1)

        if not success:
            sys.exit(1)

        update_supabase_status(
            lesson_id, "generating", 90, "Merging audio and video tracks with FFmpeg..."
        )

        rendered_video = None
        for root, dirs, files in os.walk(temp_dir):
            for file in files:
                if file.endswith(".mp4") and "BlackboardLesson" in file:
                    rendered_video = os.path.join(root, file)
                    break
            if rendered_video:
                break

        if not rendered_video:
            err_msg = "Rendered video file could not be located."
            update_supabase_status(lesson_id, "failed", 100, err_msg)
            sys.exit(1)

        concat_list_path = os.path.join(temp_dir, "concat.txt")
        with open(concat_list_path, "w") as f:
            for audio_path, _ in audio_files:
                f.write(f"file '{audio_path}'\n")

        master_audio_path = os.path.join(temp_dir, "master_audio.mp3")
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

        final_video_path = os.path.join(temp_dir, "final.mp4")
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

        storage_path = f"{user_id}/{lesson_id}/final.mp4"
        public_video_url = upload_to_supabase_storage(final_video_path, storage_path)

        if not public_video_url:
            err_msg = "Failed to upload video to Supabase Storage."
            update_supabase_status(lesson_id, "failed", 100, err_msg)
            sys.exit(1)

        update_supabase_status(
            lesson_id,
            "completed",
            100,
            "Lesson successfully generated!",
            video_url=public_video_url,
        )

    except Exception as fatal_err:
        print(f"FATAL WORKER ERROR: {fatal_err}")
        update_supabase_status(
            lesson_id, "failed", 100, f"Fatal error: {str(fatal_err)}"
        )
        sys.exit(1)
    finally:
        try:
            shutil.rmtree(temp_dir)
        except Exception:
            pass


if __name__ == "__main__":
    main()
