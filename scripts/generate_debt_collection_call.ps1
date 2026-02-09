Add-Type -AssemblyName System.Speech

$speech = New-Object System.Speech.Synthesis.SpeechSynthesizer

# Set output to WAV file
$outputPath = "debt_collection_call.wav"
$speech.SetOutputToWaveFile($outputPath)

# Get available voices
$voices = $speech.GetInstalledVoices()
Write-Host "Available voices:"
foreach ($voice in $voices) {
    Write-Host "  - $($voice.VoiceInfo.Name)"
}

# Use different voices for Agent and Customer if available
$maleVoice = $voices | Where-Object { $_.VoiceInfo.Gender -eq 'Male' } | Select-Object -First 1
$femaleVoice = $voices | Where-Object { $_.VoiceInfo.Gender -eq 'Female' } | Select-Object -First 1

# Agent lines
$speech.SelectVoice($voices[0].VoiceInfo.Name)
$speech.Speak("Agent: Hello, this is a reminder call from ABC Finance. This call is being recorded for quality and compliance purposes.")
Start-Sleep -Milliseconds 500

# Customer lines
if ($maleVoice) { $speech.SelectVoice($maleVoice.VoiceInfo.Name) }
$speech.Speak("Customer: Yeah, I know, you people keep calling me again and again. I'm already stressed.")
Start-Sleep -Milliseconds 500

# Agent
$speech.SelectVoice($voices[0].VoiceInfo.Name)
$speech.Speak("Agent: I understand your concern, sir. Before we proceed, please note that this is not a legal notice, only a payment reminder.")
Start-Sleep -Milliseconds 500

# Customer
if ($maleVoice) { $speech.SelectVoice($maleVoice.VoiceInfo.Name) }
$speech.Speak("Customer: Fine, go on.")
Start-Sleep -Milliseconds 500

# Agent
$speech.SelectVoice($voices[0].VoiceInfo.Name)
$speech.Speak("Agent: As per our records, your personal loan account ending with 7832 shows an overdue amount of thirty two thousand five hundred rupees.")
Start-Sleep -Milliseconds 500

# Customer
if ($maleVoice) { $speech.SelectVoice($maleVoice.VoiceInfo.Name) }
$speech.Speak("Customer: That's not correct. I already paid something last month.")
Start-Sleep -Milliseconds 500

# Agent
$speech.SelectVoice($voices[0].VoiceInfo.Name)
$speech.Speak("Agent: Yes sir, a payment of five thousand rupees was received on January 10th, but the remaining balance is still pending.")
Start-Sleep -Milliseconds 500

# Customer
if ($maleVoice) { $speech.SelectVoice($maleVoice.VoiceInfo.Name) }
$speech.Speak("Customer: Look, my salary was delayed and then my wife had surgery, so things got really bad financially.")
Start-Sleep -Milliseconds 500

# Agent
$speech.SelectVoice($voices[0].VoiceInfo.Name)
$speech.Speak("Agent: I'm sorry to hear that. The current interest rate on your loan is eight point seven five percent, and there is also a late payment charge of two thousand rupees.")
Start-Sleep -Milliseconds 500

# Customer
if ($maleVoice) { $speech.SelectVoice($maleVoice.VoiceInfo.Name) }
$speech.Speak("Customer: That's exactly why I'm upset. The amount keeps increasing every time I talk to someone.")
Start-Sleep -Milliseconds 500

# Agent
$speech.SelectVoice($voices[0].VoiceInfo.Name)
$speech.Speak("Agent: I understand. To help you avoid further penalties, we'd like to set up a payment arrangement.")

# Clean up
$speech.SetOutputToNull()
$speech.Dispose()

Write-Host "`nAudio file generated: $outputPath"
