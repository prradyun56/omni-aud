
$text = "This is a sample financial discussion. Hi Alice, have you reviewed the quarterly budget report? Yes Bob, I noticed that the marketing expenses are 15% higher than projected. That is correct. We invested more in the Q1 campaign to boost user acquisition. I see. As long as the ROI is positive, I approve the variance. Please update the forecast for next month. Will do. I'll send the revised invoice by EOD."

Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = 0  # Normal speed
$synth.Volume = 100

# Select a voice if possible, otherwise use default
$voices = $synth.GetInstalledVoices()
if ($voices.Count -gt 0) {
    $synth.SelectVoice($voices[0].VoiceInfo.Name)
}

$outputFile = Join-Path (Get-Location) "financial_conversation.wav"
$synth.SetOutputToWaveFile($outputFile)
$synth.Speak($text)
$synth.Dispose()

Write-Host "Generated TTS audio at $outputFile"
