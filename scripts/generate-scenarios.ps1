Add-Type -AssemblyName System.Speech

function Speak-To-Wav ($text, $filename) {
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $synth.SetOutputToWaveFile($filename)
    $synth.Speak($text)
    $synth.Dispose()
    Write-Host "Generated $filename"
}

# Scenario 1: Mortgage "Underwater" Discussion
$scenario1 = "
Agent: Thank you for calling ClearPath Mortgages. This is a recorded line. I’m looking at your account ending in 4410.
Customer: I just saw my new monthly statement. My payment went up by 40%! How is that even legal?
Agent: I understand the sticker shock. Per your original Promissory Note, you have a 5/1 ARM. The initial five-year fixed-rate period expired last month, and the rate has adjusted based on the current SOFR index plus your margin of 2.25%.
Customer: But the housing market in my area is down. I probably owe more than the house is worth now.
Agent: It’s possible you’re experiencing negative equity. Based on recent automated valuation models (AVM) in your zip code, your Loan-to-Value (LTV) ratio is currently at 105%.
Customer: So I’m underwater and I can’t afford the new rate. What are my options?
Agent: We can look into a Loan Modification or see if you qualify for a Forbearance period. However, since your loan was securitized in a private-label MBS, we have to follow specific investor guidelines for any restructuring.
"
Speak-To-Wav $scenario1 "c:\devsoc2\mortgage_underwater.wav"

# Scenario 2: Credit Card Charge-Off Prevention
$scenario2 = "
Agent: This is ABC Bank regarding your Platinum Rewards account. I’m calling because the account is now 120 days delinquent.
Customer: I told the last person, I’m waiting on a tax refund to clear this up.
Agent: I see the note here, but we are approaching the Charge-Off threshold. If this reaches 180 days without a qualifying payment, we will write this off as a loss and sell the debt to a third-party scavenger.
Customer: Will that stop the interest?
Agent: The internal interest accrual stops, but it will result in a derogatory mark on your credit report for seven years. Currently, your utilization rate is at 102% because of the over-limit fees and the default APR of 29.99%.
Customer: What if I pay half now?
Agent: We can offer a Settlement in Full for 60% of the principal balance, but we would need to report the forgiven amount to the IRS via a 1099-C form as taxable income.
"
Speak-To-Wav $scenario2 "c:\devsoc2\credit_card_chargeoff.wav"

# Scenario 3: Small Business Line of Credit (LOC) Default
$scenario3 = "
Agent: Good morning. I’m calling from the Risk Management department regarding your Revolving Line of Credit.
Customer: We haven't missed a payment. Why is Risk calling me?
Agent: While your payments are current, your latest Quarterly Financial Statements show that your Debt Service Coverage Ratio (DSCR) has fallen below the 1.25x required by your loan covenants.
Customer: We had a slow Q4. It’s just a temporary cash flow crunch.
Agent: Understood, but this triggered a Technical Default. Per the Cross-Collateralization clause, this also puts your equipment loan at risk. We are currently freezing your draw privileges on the line to mitigate further exposure.
Customer: You’re cutting off my liquidity when I need it most?
Agent: To restore the line, we’ll need an updated Aging Report for your Accounts Receivable and a personal Guarantee from the secondary partner.
"
Speak-To-Wav $scenario3 "c:\devsoc2\business_loc_default.wav"
