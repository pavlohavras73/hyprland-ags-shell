#!/usr/bin/env python3
import sys
import os
import json
import subprocess
import speech_recognition as sr

WAV_PATH = "/tmp/jarvis_mic.wav"

def record_audio(duration=4):
    cmd = ["arecord", "-d", str(duration), "-f", "cd", "-t", "wav", WAV_PATH]
    try:
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        return True
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"Ошибка записи микрофона: {e}"}))
        return False

def transcribe():
    if not os.path.exists(WAV_PATH):
        print(json.dumps({"ok": False, "error": "Файл записи не найден"}))
        return

    r = sr.Recognizer()
    try:
        with sr.AudioFile(WAV_PATH) as source:
            audio = r.record(source)
        text = r.recognize_google(audio, language="ru-RU")
        print(json.dumps({"ok": True, "text": text}))
    except sr.UnknownValueError:
        print(json.dumps({"ok": False, "error": "Не удалось распознать речь (тишина или неразборчиво)"}))
    except sr.RequestError as e:
        print(json.dumps({"ok": False, "error": f"Ошибка сервиса распознавания: {e}"}))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
    finally:
        if os.path.exists(WAV_PATH):
            try:
                os.remove(WAV_PATH)
            except Exception:
                pass

if __name__ == "__main__":
    duration = 4
    if len(sys.argv) > 1:
        try:
            duration = int(sys.argv[1])
        except ValueError:
            pass
    if record_audio(duration):
        transcribe()
