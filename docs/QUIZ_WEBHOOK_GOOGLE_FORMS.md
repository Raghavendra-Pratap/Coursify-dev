# Google Form quiz webhook – record scores in Coursify

When you use a **Google Form** as a quiz in Coursify, you can have form submissions automatically send the learner’s **score** and **pass/fail** back to Coursify. That way progress (quiz score, quiz passed) is updated without the learner leaving the form.

---

## How Coursify tells different quizzes and responses apart

- **Each submission is tied to one learner and one quiz** by a **token**. When a learner opens a quiz in Take Course, Coursify generates a **one-time signed token** that encodes:
  - **Which enrollment** (which user in which course)
  - **Which quiz** (which content item / lesson step)
- The Google Form never sends “quiz ID” or “user ID” in the body. The script only sends **token + score + passed**. The webhook **decodes the token** on the server and then knows exactly which quiz and which learner to update. So there is no mix-up between different quizzes or different users.
- **One script per Google Form.** Each quiz in Coursify is usually one Google Form. You add the **same script logic** to each form, but:
  - **Entry ID** is different for each form (each form has its own hidden field with its own entry ID).
  - **Passing score** can differ per quiz.
- In the **Add Quiz** modal in Coursify, when you fill in the “Webhook hidden field entry ID” and passing score, use **Copy Apps Script** to get code **pre-filled for this quiz** (entry ID and passing score already set). Paste that into **that form’s** Apps Script editor. For another quiz (another form), add the script to that form and use Copy again for that quiz’s entry ID and passing score.

---

## 1. Add a hidden field in your Google Form

1. In Google Forms, add a **Short answer** question.
2. Click the **three dots** (⋮) on the question → **Description** and add a note like: “Do not edit – used for Coursify.”
3. Turn **on** “**Response validation**” for that question:
   - Condition: **Regular expression** → **Matches** → pattern: `.+` (so it’s required but any non‑empty value is accepted).
4. (Optional) In the question title, name it something like “Token” so you can spot it in the response sheet.
5. **Get the entry ID** for this question:
   - In the form, click the **three dots** (⋮) → **Get pre-filled link**.
   - Add a **dummy value** (e.g. `1`) for your hidden question and click **Get link**.
   - The URL will look like:  
     `...&entry.1234567890=1&...`  
     The number **1234567890** is the **entry ID**. Copy it.

---

## 2. Set the webhook entry ID in Coursify

1. In **Coursify**, open your course in the course creator.
2. Add a quiz (or edit the lesson content) and choose **Add Quiz (Google Form)**.
3. Paste your **Google Form URL** and, if you use webhook scoring, paste the **Webhook hidden field entry ID** (the entry ID from step 1) in the optional field **“Webhook hidden field entry ID”**.
4. Set the **Passing score** to match how you’ll grade (e.g. 70 for 70%).
5. Save the course/lesson.

When a learner opens that quiz in Take Course, Coursify will put a **one-time token** into that hidden field. Your Google Form (via the script in step 3) will read that token and send the score to Coursify.

---

## 3. Add the script to this Google Form (step-by-step)

You need to add a script **to this form only** (each form has its own script). The script runs when someone submits the form and sends the token and score to Coursify.

### 3.1 Get the script from Coursify (recommended)

1. In Coursify, in the **Add Quiz** modal, fill in **Google Form URL**, **Webhook hidden field entry ID**, and **Passing score**.
2. Click **Copy Apps Script**. The code is already filled with:
   - Your Coursify webhook URL
   - The entry ID for this form
   - The passing score for this quiz  
   So you don’t need to edit the script.

### 3.2 Open Apps Script for this form

1. Open the **same** Google Form (the one you pasted into Coursify).
2. In the form menu, click **Extensions** → **Apps Script**.
3. A new tab opens with the Apps Script editor (a single file, usually `Code.gs`).

### 3.3 Paste and save the script

1. In the editor, **select all** the default code (e.g. `function myFunction() { }`) and **delete** it.
2. **Paste** the code you copied from Coursify (Ctrl+V / Cmd+V).
3. Click **Save** (disk icon) or press Ctrl+S / Cmd+S. Give the project a name if asked (e.g. “Coursify quiz webhook”).

### 3.4 Add the “on form submit” trigger

1. In the Apps Script editor, click the **Triggers** icon (clock on the left).
2. Click **+ Add Trigger** (bottom right).
3. Set:
   - **Choose which function to run:** `onFormSubmit`
   - **Select event type:** `From form`
   - **Select form event:** `On form submit`
4. Click **Save**.
5. If Google asks for permissions, click **Review permissions** and choose your account, then **Allow** (so the script can send data to Coursify).

After this, every time someone submits this form, the script will read the token from the hidden field and send the score to Coursify. Coursify will know which quiz and which learner from the token.

### 3.5 Other quizzes (other forms)

For each **other** quiz (other Google Form), repeat from **step 1** in this guide (add hidden field, get entry ID, set entry ID and passing score in Coursify for that quiz, then **Copy Apps Script** in the Add Quiz modal for that quiz and paste into **that form’s** Apps Script, then add the same trigger). The script code is the same; only the entry ID and passing score differ, and the copy button fills those for you.

---

## 4. Script code (if you don’t use Copy Apps Script)

If you prefer to type or paste the script by hand, use the snippet below. You **must** set:

- **`WEBHOOK_URL`** – Your Coursify webhook URL, e.g.  
  `https://your-app.vercel.app/api/webhooks/google-form-quiz`
- **`PASSING_SCORE`** – The same passing score you set in Coursify for this quiz (e.g. `70` for 70%).
- **`entryId`** – The **same** entry ID you pasted in Coursify (“Webhook hidden field entry ID”) for this form.

```javascript
const WEBHOOK_URL = 'https://YOUR-COURSIFY-APP/api/webhooks/google-form-quiz';
const PASSING_SCORE = 70;

function onFormSubmit(e) {
  if (!e || !e.response) return;
  var itemResponses = e.response.getItemResponses();
  var entryId = '1234567890'; // Same as in Coursify for this form
  var token = null;

  for (var i = 0; i < itemResponses.length; i++) {
    var r = itemResponses[i];
    if (String(r.getItem().getId()) === entryId) {
      token = r.getResponse();
      break;
    }
  }

  if (!token) return;

  var totalScore = 0;
  var maxScore = 0;
  var form = FormApp.getActiveForm();
  var items = form.getItems();
  for (var j = 0; j < items.length; j++) {
    var item = items[j];
    var gr = e.response.getGradableResponseForItem(item);
    if (gr) {
      totalScore += gr.getScore();
      try { maxScore += item.asQuizItem().getPoints(); } catch (err) {}
    }
  }
  var score = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  var passed = score >= PASSING_SCORE;

  UrlFetchApp.fetch(WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ token: token, score: Math.round(Number(score)), passed: !!passed }),
    muteHttpExceptions: true
  });
}
```

---

## Security (no backtrack or injection)

- Only **authenticated learners** get a **signed one-time token** when they open the quiz in Coursify.
- The webhook accepts **only** that token (verified with a server secret). All identifiers (enrollment, content item) come from the token, not from the request body.
- Tokens are **one-time use** and **replay-protected**; duplicate or old tokens are rejected.
- Request body is strictly validated (score 0–100, passed boolean); no raw user input is used for DB keys or process control.
