import os
import sys
import shutil
import re
import json
import asyncio
import time
import whisper
from groq import Groq
from transformers import pipeline

# --- 1. CONFIGURATION ---
def check_dependencies():
    if not shutil.which("ffmpeg"):
        print("❌ CRITICAL: FFmpeg missing!")
        sys.exit(1)
    if not os.environ.get("GROQ_API_KEY"):
        print("⚠️  WARNING: GROQ_API_KEY is not set.")

def select_audio_file():
    extensions = ('.wav', '.mp3', '.m4a', '.flac')
    files = [f for f in os.listdir('.') if f.lower().endswith(extensions)]
    if not files:
        print("\n❌ No audio files found!"); sys.exit(1)
    
    print("\n📂 EDGE DATASET:")
    for i, f in enumerate(files, 1): print(f" [{i}] {f}")
    
    while True:
        try:
            choice = int(input("Select file (Number): ")) - 1
            if 0 <= choice < len(files): return files[choice]
        except: pass

# --- 2. THE AGGRESSIVE REDACTOR (FIXED) ---
class LocalRedactor:
    def __init__(self):
        print("🛡️  Loading Local Neural Engine...")
        self.ner = pipeline("ner", model="dslim/bert-base-NER", aggregation_strategy="simple")

    def redact(self, text):
        vault = {}
        redacted_text = text
        
        # COUNTERS
        counters = {'MONEY': 1, 'RATE': 1, 'DATE': 1, 'DETAIL': 1}
        
        def replace(match, type_key):
            val = match.group(0)
            token = f"[{type_key}_{counters[type_key]}]"
            vault[token] = val
            counters[type_key] += 1
            return token

        # --- STEP 1: REGEX (Numbers First!) ---
        
        # A. MONEY (Matches: 5,000 rupees | $300 | 5000 INR)
        # Note: We catch "rupees/dollars" specifically to avoid confusing them with generic numbers
        money_pattern = r'(?:\$|₹|€|£)\s?[\d,]+(?:\.\d{2})?|[\d,]+(?:\.\d{2})?\s+(?:rupees|dollars|cents|euros|inr|usd)'
        redacted_text = re.sub(money_pattern, lambda m: replace(m, 'MONEY'), redacted_text, flags=re.IGNORECASE)

        # B. DATES (Matches: January 10 | 2024-01-01 | 10th Jan)
        date_pattern = r'(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?|\d{4}-\d{2}-\d{2}'
        redacted_text = re.sub(date_pattern, lambda m: replace(m, 'DATE'), redacted_text, flags=re.IGNORECASE)

        # C. RATES (Matches: 8.75% | 15 percent)
        rate_pattern = r'\b\d+(?:\.\d+)?\s?(?:%|percent)\b'
        redacted_text = re.sub(rate_pattern, lambda m: replace(m, 'RATE'), redacted_text, flags=re.IGNORECASE)

        # D. DETAILS (Matches: 7,832 | 1234-5678)
        # Catches any remaining group of 4+ digits (account numbers, IDs)
        # We run this LAST so it doesn't "eat" the money numbers
        detail_pattern = r'\b(?:\d[-,]?){4,}\b'
        redacted_text = re.sub(detail_pattern, lambda m: replace(m, 'DETAIL'), redacted_text)

        # --- STEP 2: AI NAMES (Context Aware) ---
        entities = self.ner(redacted_text)
        name_counter = 1
        entities.sort(key=lambda x: x['start'], reverse=True)
        
        for entity in entities:
            if entity['entity_group'] == 'PER': # Only People
                token = f"[NAME_{name_counter}]"
                original = redacted_text[entity['start']:entity['end']]
                
                # Double check we aren't redacting a token we just made
                if "[" not in original:
                    redacted_text = redacted_text[:entity['start']] + token + redacted_text[entity['end']:]
                    vault[token] = original
                    name_counter += 1
            
            # Catch Organizations (like "ABC Finance")
            elif entity['entity_group'] == 'ORG':
                token = f"[ORG_{name_counter}]" # Optional: distinct ORG token
                original = redacted_text[entity['start']:entity['end']]
                if "[" not in original:
                    redacted_text = redacted_text[:entity['start']] + token + redacted_text[entity['end']:]
                    vault[token] = original

        return redacted_text, vault

# --- 3. CLOUD LOGIC ---
class CloudAnalyst:
    def __init__(self):
        key = os.environ.get("GROQ_API_KEY") or "gsk_PASTE_KEY_HERE"
        self.client = Groq(api_key=key)

    def analyze_logic(self, safe_text):
        # We ask the AI to verify if the math is "Negative" (Debt/Loss) or "Positive" (Income/Gain)
        prompt = f"""
        Analyze REDACTED text. 
        For every [RATE_x] or [MONEY_x], determine if it represents a NEGATIVE thing (Debt, Penalty, Loss) or POSITIVE (Income, Profit).
        Text: "{safe_text}"
        Return JSON: {{ "[MONEY_1]": "NEGATIVE", "[RATE_1]": "POSITIVE" }}
        """
        try:
            completion = self.client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.3-70b-versatile",
                response_format={"type": "json_object"}
            )
            return json.loads(completion.choices[0].message.content)
        except: return {}

# --- 4. BACKBOARD STORAGE (Simulation) ---
async def save_to_backboard(filename, vault_data, context):
    print("\n💾 Saving to Secure Storage...")
    
    # SIMULATING DATABASE WRITE
    time.sleep(1)
    backup_file = f"vault_{filename}.json"
    data = {
        "status": "ENCRYPTED_AT_REST",
        "timestamp": time.ctime(),
        "source": filename,
        "vault": vault_data
    }
    with open(backup_file, "w") as f:
        json.dump(data, f, indent=4)
        
    print(f"✅ SUCCESS: Identity Vault stored securely in '{backup_file}'")

# --- MAIN ---
if __name__ == "__main__":
    check_dependencies()
    target = select_audio_file()
    
    whisper_engine = whisper.load_model("small")
    redactor = LocalRedactor()
    analyst = CloudAnalyst()
    
    print(f"\n🎧 Transcribing '{target}'...")
    raw_text = whisper_engine.transcribe(target)['text']
    
    print("🛡️  Redacting (Aggressive Mode)...")
    safe_text, vault = redactor.redact(raw_text)
    
    print("☁️  Cloud Logic Check...")
    logic = analyst.analyze_logic(safe_text)
    
    # Final Vault Assembly
    final_vault = {}
    for k, v in vault.items():
        if k in logic and logic[k] == "NEGATIVE":
            final_vault[k] = f"-{v}" # Mark debt as negative
        else:
            final_vault[k] = v

    # DISPLAY
    print("\n" + "="*60)
    print("🔒 REDACTED CONTEXT (What the Cloud Sees)")
    print("="*60)
    print(safe_text)
    
    print("\n" + "="*60)
    print("🔑 IDENTITY VAULT (What the Bank Sees)")
    print("="*60)
    for k, v in final_vault.items():
        print(f"   {k.ljust(12)} : {v}")
    print("="*60)

    asyncio.run(save_to_backboard(target, final_vault, safe_text))