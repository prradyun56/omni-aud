from transformers import AutoTokenizer, AutoModelForTokenClassification

model_id = "dslim/bert-base-NER"

print(f"🚀 Force-downloading model: {model_id}...")
print("This may take 2-5 minutes. Please wait.")

# This forces a fresh connection to the server
tokenizer = AutoTokenizer.from_pretrained(model_id, force_download=True)
model = AutoModelForTokenClassification.from_pretrained(model_id, force_download=True)

print("\n✅ Download Complete! You can now run main.py.")