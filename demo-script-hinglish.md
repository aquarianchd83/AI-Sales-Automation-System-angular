# WhatsApp Sales Automation — Customer Demo Script (Hinglish)

Is doc mein do versions hain: ek **~75–90 second ka teaser** (bilkul niche) jo first-touch send
ke liye hai — LinkedIn, ek email intro, ya Slack drop — aur ek **full ~14–16 minute ka
walkthrough** (aage) jo actual customer meeting ke liye hai. Dono ko ek hi sitting mein, same
setup use karke record karo; teaser basically full recording ke best moments ka re-cut hai, koi
alag take nahi.

**Recording tools:** OBS Studio (free), Loom, ya Windows ka built-in Xbox Game Bar (`Win+G`).
1080p pe record karo, browser window maximized rakho, browser mein zoom ~110% rakho taaki text
shared screen pe clearly dikhe.

---

## Teaser cut (~75–90 seconds)

Same setup checklist jo full version mein hai (niche) yahan bhi apply hoti hai — ye bas usi ka
ek slice use karta hai. Live AI-reply wale moment se lead karo kyunki ye product ka sabse
convincing cheez hai; baaki sab fast flashes hain jo prove karte hain ki iske peeche real depth
hai.

**Structure — 4 beats, tight cut, koi dead air nahi:**

| Time | Screen | Say / show |
|---|---|---|
| 0:00–0:08 | Inbox, kuch bhi click nahi kiya | *"Ye dekho — ek customer message karta hai, aur AI usse handle karta hai. Koi agent involved nahi."* |
| 0:08–0:40 | Trigger script run karo (niche Section 5b dekho) → conversation pe cut karo | Inbound message dikhao, AI ka reply directly uske neeche aata hua, aur confidence/intent row. *"Ye ek real signed WhatsApp webhook hai jo abhi API ko hit kar raha hai — AI intent detect kar raha hai, ek grounded reply generate kar raha hai, aur usse waapas bhej raha hai. Live."* |
| 0:40–1:10 | 3 quick cuts, ~7–8s each: Campaign detail (steps + status), Leads pipeline (score column), Handoffs queue | Teeno pe ek continuous line: *"Har campaign apne schedule pe khud chalta hai, har lead automatically score hota hai jaise-jaise AI unse baat karta hai, aur jo bhi cheez mein AI confident nahi hai wo ek queue mein chali jaati hai ek human ke liye."* |
| 1:10–1:30 | Wapas Dashboard pe, ya agar ho toh ek title card | *"Ek hi platform, outbound campaign se lekar AI-qualified lead tak. Chalo baat karte hain ki ye aapke liye kaisa dikhega."* |

**Editing tip:** agar 60 seconds flat ke andar laana ho toh Beat 3 ko 2 clips tak cut kar do
(Campaigns + Leads, Handoffs hata do) — Handoffs teeno mein sabse kam essential hai cold-open
teaser ke liye kyunki Section 5b already escalation exist karna imply kar deta hai.

---

## Full walkthrough (~14–16 minutes)

Agar shorter cut chahiye toh Section 8 (Knowledge Base/Admin) hata do — baaki sab core product
story hai.

---

## Record karne se pehle — 5-minute ka setup checklist

Ye recording *se pehle* kar lo taaki beech mein kahin ruko na:

1. **Dono servers running hone chahiye**: API `https://localhost:59205` pe, Angular dev server
   `http://localhost:4200` pe (`npm start`).
2. **SuperAdmin ke roop mein log in karo** taaki har menu item visible ho (Users & Roles
   SuperAdmin/Admin-only hai — in mein se kisi ek se log in karo, warna Section 8 ke liye account
   switch karna padega).
3. **Pehle se kuch cheezein seed kar lo** taaki camera pe screens khali na dikhein:
   - Kam se kam ek **Message Template** jo already Approved ho.
   - Kam se kam ek **Campaign** jisme steps attached hon aur, ideally, ek jo actually `Running`
     ya `Stopped` ho (sirf `Draft` nahi) — history wali lifecycle empty new campaign se better
     lagti hai.
   - Kam se kam ek **Knowledge Base article**, Published.
   - Ek test **Customer** jiska real, distinctive naam ho ("Test Test" nahi) — Section 5 mein
     tum "unke jaise" message karoge.
4. **AI-demo script ready rakho** (Section 5 ke end wale box mein dekho) ek terminal tab mein,
   pre-filled, taaki "customer message aata hai → AI live reply karta hai" wala moment ek
   keypress ho, camera pe typing delay na ho.
5. Koi bhi unrelated browser tabs/notifications close kar do. Slack/Teams silent kar do.

---

## Cold open (0:00–0:30)

**Screen:** Campaign list ya Dashboard, abhi kuch click nahi kiya.

**Bolo:**
> "Ye ek WhatsApp sales automation platform hai — ye aapke outbound campaigns run karta hai, ek
> AI ko inbound replies automatically qualify aur respond karne deta hai, aur jaise hi kisi
> conversation ko human ki zaroorat padti hai, usse ek human agent ko handoff kar deta hai. Main
> ise end to end walk through karunga, including ye dekhna ki AI actually ek live message ka
> reply kaise deta hai."

---

## Section 1 — Orientation (0:30–1:30)

**Screen:** Dashboard, phir left nav pe hover karo bina sab kuch click kiye.

**Dikhao:** Sidebar — Dashboard, Customers, Inbox, Handoffs, Leads, Knowledge Base, Tags,
Campaigns, Media Library, Message Templates, Users & Roles.

**Bolo:**
> "Sab kuch customer lifecycle ke around organized hai: aap apne contacts aur tags manage karte
> ho, outbound Campaigns run karte ho, aur jo bhi wapas aata hai — replies, escalations,
> qualified leads — wo sab Inbox, Handoffs, aur Leads se hoke flow karta hai. AI ka knowledge
> Knowledge Base se aata hai."

---

## Section 2 — Customers & Tags (1:30–3:00)

**Screen:** Customers list.

**Dikhao:**
- Customer table — phone, opt-in status, tags.
- Ek customer open karke unka detail dikhao (tags, opt-in history).
- Tags page — do-ek tags, aur customer list se bulk-tagging ka mention karo.

**Bolo:**
> "Har contact ka ek opt-in status hota hai — WhatsApp par kisi ko commercially message karne se
> pehle explicit consent chahiye hota hai, aur platform ise send time pe enforce karta hai, sirf
> ek UI suggestion ke roop mein nahi. Tags se aap apni audience ko campaigns ke liye segment
> karte ho — 'VIP', 'Cold Lead', jo bhi aapke business ke liye fit baithe."

---

## Section 3 — Campaigns, outbound engine (3:00–7:00)

Ye sabse meaty section hai — yahan time lo.

### 3a. Campaign list

**Screen:** Campaigns list.

**Dikhao:** Status legend (do-ek chips pe hover karke tooltips dikhao), table columns —
Scheduled start / Start date / End date, sab full date+time ke saath.

**Bolo:**
> "Har campaign ek real lifecycle se guzarta hai — Draft, Scheduled, Running, Paused, Stopped,
> Completed — aur UI hamesha sirf wahi actions offer karta hai jo campaign ki current position
> ke hisaab se actually valid hon."

### 3b. Ek campaign create karo

**Screen: **New campaign** pe click karo.

**Dikhao:**
- Name/description.
- Scheduled-start **date + time picker** — ek date pick karo, phir specific time set karo.

**Bolo:**
> "Aap ek campaign ko specific date aur time ke liye schedule kar sakte ho — sirf midnight nahi
> — aur jab wo moment aata hai to ye automatically khud ko Running mein promote kar deta hai."

### 3c. Steps — Initial + unlimited follow-ups

**Screen:** Campaign ka detail page open karo → Steps section.

**Dikhao:**
- Initial step add karo (ek template pick karo).
- Ek follow-up add karo, delay-days field dikhate hue.
- Mention karo (time ke liye zaroori nahi ki live add karo) ki follow-ups ki count pe **koi
  cap nahi** hai — Initial, FollowUp1, FollowUp2, ...FollowUp*N*, jitne bhi sequence ko
  chahiye utne.

**Bolo:**
> "Steps strict order mein attach hote hain — beech mein gap nahi chhod sakte — lekin ek
> sequence mein kitne follow-ups ho sakte hain, uski koi limit nahi hai. Har ek, pichhle wale ke
> actually send hone ke baad, kitne bhi din wait kar sakta hai."

### 3d. Audience + End date projection

**Screen:** Tag se ek audience attach karo. **End date** column/field point out karo.

**Bolo:**
> "Ek baar campaign ka start date aur kam se kam ek active step set ho jaaye, to platform
> automatically ek finish date project kar deta hai — start plus sequence ka total delay. Agar
> campaign Stop ho jaata hai, to wo estimate ki jagah exact stop time ban jaata hai."

### 3e. Lifecycle — Start / Pause / Resume / Stop / Run job now

**Screen:** Campaign start karo (ya jo already Running hai wo use karo).

**Dikhao:**
- Pause → Resume.
- **Stop**, phir dikhao ki uske baad bhi ye **Resume** ho sakta hai (ye specially call out karo
  — ye dead end nahi hai).
- **⚡ Run job now** icon, har campaign ke liye — click karo, result dialog dikhao (sends
  counted, considered, skipped).
- Agar campaign Stopped hai, to ye bhi dikhao ki abhi ise **Delete** bhi kiya ja sakta hai (sirf
  Draft campaigns nahi) — aur confirm dialog jo warning deta hai ki Stopped campaign delete
  karne se uski message history bhi erase ho jaati hai.

**Bolo:**
> "Normally send pipeline apne schedule pe khud chalta hai, lekin aap ek campaign ke liye ise
> abhi force run kar sakte ho — jaise iss demo ke liye useful hai, ya kisi backlog ko nudge karne
> ke liye. Aur ek campaign ko stop karna permanent nahi hai — aap baad mein ise resume kar sakte
> ho, ya agar aapko usse kaam nahi hai to poori tarah delete kar sakte ho, jisse uski message
> history bhi clean ho jaati hai."

---

## Section 4 — Message Templates & Media (7:00–8:00)

**Screen:** Message Templates list, phir Media Library.

**Dikhao:** Ek template ka Approve/Reject review action. Media library grid.

**Bolo:**
> "Koi campaign use karne se pehle templates ek approval step se guzarte hain — jaise WhatsApp
> ka apna khud ka template approval process hota hai waise hi. Media assets ek step ke saath
> attach hote hain aur message ke saath bhej diye jaate hain."

---

## Section 5 — Inbox: jahan AI rehta hai (8:00–12:00)

Ye demo ka highlight hai. Yahan slow down karo.

### 5a. Inbox list

**Screen:** Inbox.

**Dikhao:** Status filter toggles (Open/Escalated/Closed/All), Lead-score column.

**Bolo:**
> "Har reply — chahe wo ek campaign follow-up se aayi ho ya customer ne yun hi out of the blue
> message kiya ho — yahan ek conversation ke roop mein land karta hai."

### 5b. Ek live AI reply trigger karo, camera pe

Ye wo moment hai jo product ko sell karta hai. Terminal ready rakho.

**Run karne se pehle bolo:**
> "Chalo main abhi ek real customer message aane ko simulate karta hoon, bilkul waise hi jaise
> WhatsApp deliver karta — signed webhook aur sab kuch — taaki aap AI ko live respond karte hue
> dekh sako."

Prepared script **run** karo (niche wala box dekho), phir **turant Inbox pe switch** karo aur
refresh karo — naya conversation kuch seconds mein appear ho jaana chahiye.

**Conversation open karo. Order mein dikhao:**
1. Wo inbound message jo tumne abhi "bheja."
2. Uske bilkul neeche AI ka reply — automatically sent, koi agent involved nahi.
3. **AI row**: confidence percentage, detected intent, aur (agar Lead already exist karta hai to)
   lead-score chip.
4. AI-maintained **summary** line.

**Bolo:**
> "Ye poora loop — inbound message, intent detection, ek grounded reply, WhatsApp par wapas
> bheja gaya — ismein koi human involved nahi tha. Confidence score aur detected intent
> waheen dikh rahe hain, taaki inbox pe ek glance daalte hi agent ko pata chal jaaye ki AI
> kitna sure tha."

> **Reusable trigger script** — phone number aur message text adapt karo,
> `simulate-inbound.ps1` naam se save karo, PowerShell prompt se run karo jab API chal raha ho:
> ```powershell
> [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
> [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
>
> $phone = "919815733426"          # E.164 digits, no '+', no country-code prefix issues
> $messageText = "Hi, what's the price?"   # escalation path ke liye "I want a refund, this is terrible" try karo
>
> $msgId = "wamid.DEMO_" + [guid]::NewGuid().ToString("N")
> $timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds().ToString()
> $payloadObj = @{ entry = @(@{ changes = @(@{ value = @{
>     contacts = @(@{ wa_id = $phone; profile = @{ name = "Demo Customer" } })
>     messages = @(@{ id = $msgId; from = $phone; timestamp = $timestamp; type = "text"; text = @{ body = $messageText } })
> } }) }) }
> $body = $payloadObj | ConvertTo-Json -Depth 10 -Compress
>
> $secret = "dev-app-secret-not-for-production"   # matches appsettings.Development.json — dev only
> $hmac = [System.Security.Cryptography.HMACSHA256]::new([System.Text.Encoding]::UTF8.GetBytes($secret))
> $hex = -join ($hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($body)) | ForEach-Object { $_.ToString("x2") })
>
> Invoke-WebRequest -Uri "https://localhost:59205/api/v1/webhooks/whatsapp" -Method POST `
>   -Body $body -ContentType "application/json" `
>   -Headers @{ "X-Hub-Signature-256" = "sha256=$hex" } -UseBasicParsing
> ```
> **escalation** path (Section 6) demo karne ke liye `$messageText` ko kuch aise change karo
> *"I want a refund, this is terrible"* — ye auto-reply ki jagah ek Handoff raise karta hai.

### 5c. Manual agent reply — text vs. template

**Screen:** Wahi conversation, composer tak scroll karo.

**Dikhao:**
- Text/Template toggle.
- Ek free-text reply type karo aur bhejo (ye sirf 24h customer-service window ke andar kaam
  karta hai — ye mention karo).
- Template mode pe switch karo, ek pick karo, bhejo (ye kabhi bhi kaam karta hai).

**Bolo:**
> "Ek agent kisi bhi point pe manually jump in kar sakta hai — free text agar customer ne
> recently enough message kiya ho ki WhatsApp ki service window abhi bhi open ho, ya ek approved
> template, jo timing ki parwah kiye bina kaam karta hai."

### 5d. Mode switch + assign + close

**Dikhao:** Mode ko Human pe switch karo (AB AI is thread pe reply karna band kar deta hai), ek
agent ko assign karo, Conversation Close karo.

**Bolo:**
> "Aap ek conversation ko poori tarah autopilot se hata sakte ho, kisi specific agent ko hand
> kar sakte ho, ya resolve hone ke baad usse close kar sakte ho."

---

## Section 6 — Handoffs: human escalation (12:00–13:30)

**Screen:** Handoffs queue.

**Dikhao:**
- Agar tumne upar wale script se "refund/terrible" message run kiya, to naya Pending handoff
  yahan hona chahiye — usse open karo.
- Ise **Claim** karo.
- Ek note ke saath **Resolve** karo.

**Bolo:**
> "Jab bhi AI kaafi confident nahi hota, ya customer ka message ek complaint, negotiation, ya
> explicit human request signal karta hai, to ye guess karne ki bajaye yahan escalate ho jaata
> hai. Ek agent ise claim karta hai, kaam karta hai, aur ek note ke saath resolve karta hai
> record ke liye."

---

## Section 7 — Leads: AI-driven qualification (13:30–15:00)

**Screen:** Leads pipeline.

**Dikhao:**
- Stage/score columns, stage ya score se filter karo.
- Apni demo conversation se bane lead ko open karo (agar usne message se budget/interest/
  timeline extract kiya ho).
- **Activity timeline** — un entries ko point out karo jinme koi agent name nahi hai (AI-driven)
  vs jinme agent ka naam hai (manual corrections).

**Bolo:**
> "Jaise-jaise AI ek customer se baat karta hai, ye background mein budget, interest, aur
> timeline signals bhi extract karta rehta hai, aur lead ko automatically Hot/Warm/Cold score
> karta hai. Ek agent hamesha stage ya extracted details ko haath se correct kar sakta hai —
> har change, automatic ho ya manual, yahan record pe hai."

---

## Section 8 — Knowledge Base: AI ka ground kya hai (15:00–16:00, optional)

**Screen:** Knowledge Base.

**Dikhao:**
- Ek existing Published article.
- Ek naya banao, Publish action dikhao (chunk + embed).
- Edits ke baad bulk re-embedding ke liye Reindex ka mention karo.

**Bolo:**
> "Ye wahi cheez hai jise AI actually cite karta hai jab wo ek factual question ka jawab deta
> hai — sirf Published articles use hote hain, to aap exactly control karte ho ki AI kya bol
> sakta hai, jo bhi aap yahan publish karte ho uske through."

---

## Closing (last 30 seconds)

**Screen:** Wapas Dashboard ya Inbox pe.

**Bolo:**
> "To end to end: aap ek campaign banate ho, wo apne schedule pe reach out karta hai, replies
> wapas ek hi inbox mein aati hain, AI jispe confident hai wo handle karta hai aur baaki human
> ko handoff kar deta hai, aur is process mein har lead automatically score aur track hota hai.
> Iske kisi bhi part pe deeper jaane mein khushi hogi."

---

## Jo bhi ise edit kare uske liye notes

- Trailer/teaser cut ke liye sabse strong clip **Section 5b** (live AI reply) hai — agar full
  walkthrough ki jagah 60-second version cut kar rahe ho to isi se lead karo.
- Agar camera pe kuch error ho jaaye (stale customer-service-window message, ek validation
  message), to authenticity ke liye usse chhod dena bhi fine hai, ya sirf uss beat ko cut karke
  re-take karo — poore section ko dobara record karne ki zaroorat nahi.
