---
name: mock-interview
description: >
  Simulate Big Tech technical interviews for software engineers. Practice Coding (LeetCode-style), System Design, and Behavioral questions with feedback and coaching.
  Use when you want to practice for Big Tech interviews (Google, Meta, Amazon, Airbnb, etc.) or sharpen your interview skills.
  Do NOT use when you want live coding execution (this is for practice/feedback only) or when you need real company-specific questions (skill is company-agnostic).
---

# Mock Interview — Big Tech Preparation

Practice for Big Tech technical interviews with structured mock sessions. This skill simulates Coding, System Design, and Behavioral interviews with frameworks, evaluation criteria, and optional feedback.

## Prerequisites

None — this skill works standalone. For best results, have your resume and target company in mind.

## When to Use

- You want to practice answering coding problems aloud
- You want to practice system design discussions
- You want to prepare STAR stories for behavioral questions
- You want feedback on your interview performance
- You want to learn the frameworks for each interview type

## When NOT to Use

- You need a real coding environment to execute code (use LeetCode instead)
- You want real interview questions from a specific company (NDA concerns)
- You just want to read about interview tips (use blog posts or YouTube)
- You're not preparing for Big Tech interviews

---

## Session Setup

At the start of each session, ask the user:

```
🎯 Mock Interview Session

Before we begin, I need a few details:

1. Which mode would you like?
   - A: Practice — You answer, I ask follow-ups (no scoring)
   - B: Feedback — You answer, I give scores and detailed feedback
   - C: Coaching — I teach the framework first, then we practice

2. Which interview type(s) to cover?
   - A: Coding only
   - B: System Design only
   - C: Behavioral only
   - D: All three (full mock)

3. (Optional) Target company: _________
   If specified, I'll adjust style/tone to match that company's format.

Ready? Choose your options.
```

---

## Interview Types

### 1. Coding Interview (LeetCode-style)

#### Framework: CPES

| Phase              | Description                                               | Time Guidance |
| ------------------ | --------------------------------------------------------- | ------------- |
| **C**larify        | Ask clarifying questions about the problem                | 2-3 min       |
| **P**lan           | Explain your approach and algorithm                       | 3-5 min       |
| **E**xplain & Code | Walk through your solution while coding                   | 15-20 min     |
| **S**ummarize      | Test your code, analyze complexity, discuss optimizations | 5 min         |

#### Evaluation Criteria

| Criterion        | Description                                   | Weight |
| ---------------- | --------------------------------------------- | ------ |
| Correctness      | Does the solution solve the problem?          | 30%    |
| Communication    | Did you explain your thinking?                | 20%    |
| Code Quality     | Is the code clean, readable, well-structured? | 20%    |
| Time Complexity  | Is the solution optimal?                      | 15%    |
| Space Complexity | Is memory usage reasonable?                   | 15%    |

#### Question Bank References

- **Blind 75**: https://neetcode.io/practice/practice/blind75
- **Neetcode 150**: https://neetcode.io/practice/practice/neetcode150
- **Neetcode Roadmap**: https://neetcode.io/roadmap

> **Note:** The skill references these resources. You bring your own problems from these lists, or any other source.

#### How to Run a Coding Session

**In Practice Mode:**

1. User selects/solves a problem (from their chosen source)
2. User walks through their approach using CPES framework
3. You ask clarifying follow-up questions
4. At the end, summarize what went well and what to improve

**In Feedback Mode:**

1. Same as practice, but score each criterion 1-5
2. Provide specific feedback on each area
3. Give actionable next steps

**In Coaching Mode:**

1. Teach the CPES framework with examples
2. Explain what interviewers look for
3. Share common mistakes
4. Then practice with the user

---

### 2. System Design Interview

#### Framework: SSDAR

| Phase         | Description                          | Questions to Ask                        |
| ------------- | ------------------------------------ | --------------------------------------- |
| **S**cope     | Clarify requirements and constraints | "What scale? Any latency requirements?" |
| **S**ketch    | High-level architecture overview     | "What are the main components?"         |
| **D**eep Dive | Dive into specific components        | "How does X work under the hood?"       |
| **A**nalyze   | Trade-offs and bottlenecks           | "What are the weak points?"             |
| **R**esolve   | Address concerns and scale           | "How would you handle X?"               |

#### Evaluation Criteria

| Criterion              | Description                           | Weight |
| ---------------------- | ------------------------------------- | ------ |
| Scope Definition       | Did you clarify requirements first?   | 20%    |
| Architecture Knowledge | Did you use appropriate patterns?     | 25%    |
| Scalability Thinking   | Did you address scale from the start? | 20%    |
| Communication          | Was your explanation clear?           | 20%    |
| Trade-off Reasoning    | Did you discuss pros/cons?            | 15%    |

#### Common System Design Topics

- **URL Shortener** (e.g., bit.ly)
- **Twitter/Social Feed** (e.g., timeline, search)
- **Uber/Ride-sharing** (e.g., matching, dispatch)
- **YouTube/Streaming** (e.g., video upload, playback)
- **E-commerce** (e.g., cart, checkout, inventory)
- **Design Patterns**: Load balancers, Caching (Redis), Databases (SQL vs NoSQL), Message queues, Sharding, Replication

#### How to Run a System Design Session

**In Practice Mode:**

1. User picks a design problem (or you suggest one)
2. User drives the discussion using SSDAR framework
3. You play the interviewer — ask probing questions
4. At the end, summarize approach and gaps

**In Feedback Mode:**

1. Score each criterion 1-5
2. Provide specific feedback on architecture choices
3. Suggest improvements and alternative approaches

**In Coaching Mode:**

1. Teach SSDAR framework with a simple example
2. Explain key concepts: CAP theorem, ACID vs BASE, load balancing, caching
3. Share common mistakes (jumping to design, ignoring scale)
4. Then practice with the user

---

### 3. Behavioral Interview (Leadership)

#### Framework: STAR

| Phase         | Description                  | Tips                   |
| ------------- | ---------------------------- | ---------------------- |
| **S**ituation | Set the context              | Be specific, not vague |
| **T**ask      | Describe your responsibility | What was your role?    |
| **A**ction    | Explain what you did         | Use "I", not "we"      |
| **R**esult    | Share the outcome            | Quantify when possible |

#### Evaluation Criteria

| Criterion   | Description                        | Weight |
| ----------- | ---------------------------------- | ------ |
| Clarity     | Was the story easy to follow?      | 25%    |
| Specificity | Were details concrete?             | 20%    |
| Impact      | Was the result meaningful?         | 25%    |
| Reflection  | Did you show learning?             | 15%    |
| Alignment   | Did it match the company's values? | 15%    |

#### Common Themes & Questions

**Leadership:**

- "Tell me about a time you showed leadership"
- "Describe a time you had to motivate a team"
- "Give an example of when you took initiative"

**Conflict Resolution:**

- "Tell me about a disagreement with a coworker"
- "Describe a time you had to handle a difficult person"

**Failure & Learning:**

- "Tell me about a time you failed"
- "Describe a mistake you made and what you learned"

**Technical Challenges:**

- "Tell me about a hard technical problem you solved"
- "Describe a time you had to learn something quickly"

**Teamwork:**

- "Tell me about a time you collaborated with a difficult team"
- "Give an example of how you helped someone succeed"

#### Company-Specific Focus

| Company | Behavioral Focus                                                                |
| ------- | ------------------------------------------------------------------------------- |
| Google  | Leadership, Googlyness, General Cognitive                                       |
| Amazon  | 14 Leadership Principles (Customer Obsession, Dive Deep, Bias for Action, etc.) |
| Meta    | Move Fast, Bold, Focus on Impact                                                |
| Airbnb  | Belong Anywhere, Champion the Mission, Be a Host                                |

#### How to Run a Behavioral Session

**In Practice Mode:**

1. User picks a theme (or you suggest one)
2. User tells their story using STAR
3. You ask follow-up questions to go deeper
4. At the end, summarize the story's strengths

**In Feedback Mode:**

1. Score each criterion 1-5
2. Provide feedback on STAR structure
3. Suggest stronger result quantification

**In Coaching Mode:**

1. Teach the STAR framework with examples
2. Explain what each company looks for
3. Help user identify their best stories
4. Then practice with the user

---

## Providing Feedback

### Score Rubric

| Score | Description                            |
| ----- | -------------------------------------- |
| 5     | Exceptional — exceeds expectations     |
| 4     | Good — solid performance               |
| 3     | Adequate — meets minimum expectations  |
| 2     | Below expectations — needs improvement |
| 1     | Poor — significant gaps                |

### Feedback Template

```
## Feedback Summary

### [Interview Type]

| Criterion | Score | Notes |
|-----------|-------|-------|
| Criterion 1 | 3/5 | Specific observation |
| Criterion 2 | 4/5 | Specific observation |

### Strengths
- What you did well

### Areas to Improve
- Specific areas to work on

### Next Steps
- Actionable items for next session
```

---

## Edge Cases

### User Has No Questions Prepared

If the user hasn't picked problems to solve:

```
No problem. I can suggest topics:

For Coding:
- Pick a topic: Arrays, Strings, Trees, Graphs, DP
- Or tell me your comfort level (Easy/Medium/Hard) and I'll suggest

For System Design:
- Pick a system: Twitter, Uber, YouTube, etc.
- Or I can suggest one

For Behavioral:
- Pick a theme: Leadership, Conflict, Failure, etc.
- Or we can do a free-form chat

What would you like?
```

### User Struggles to Answer

If the user is stuck:

**For Coding:**

- "What data structure could help here?"
- "What's the brute force approach first?"
- "Can you think of this problem differently?"

**For System Design:**

- "What do you think is the bottleneck?"
- "How would you handle 10x scale?"
- "What are you uncertain about?"

**For Behavioral:**

- "Tell me more about that situation"
- "What was the hardest part?"
- "What would you do differently now?"

### User Wants Company-Specific Questions

If the user asks for real questions from Google/Meta/etc.:

```
I don't have access to real interview questions (NDA concerns).
But I can:
- Match the difficulty and style of your target company
- Focus on topics that company typically asks
- Adjust my follow-up questions to match their format

For example, Google tends to be harder on algorithms and focus on distributed systems. Amazon focuses on the Leadership Principles.

Want me to adjust the session for [Company]?
```

---

## Best Practices

- **Ask for mode first** — Don't assume. Let the user choose Practice/Feedback/Coaching
- **Be the interviewer** — Ask follow-up questions, probe deeper, play the role
- **Focus on frameworks** — Teach the approach, not just the answer
- **Reference the resources** — Link to Neetcode 150 and Blind 75 for coding practice
- **Keep it company-agnostic** — Adjust style if user specifies company, but don't claim to have real questions
- **End with summary** — Always recap what went well and what to improve

---

## Integration with Other Skills

### From `grill-me`

If the user is unsure what to practice:

```
Use grill-me to help them decide:
- What's their target company?
- What's their weakest area?
- How much time do they have?

Then hand off to mock-interview.
```

### With `mixture-of-experts`

For deeper analysis:

```
After a mock interview, use mixture-of-experts to get:
- Architecture expert feedback on system design
- Leadership expert feedback on behavioral answers
- Technical expert feedback on coding approach
```

---

## Session Flow Example

```
You: 🎯 Mock Interview Session

Before we begin, I need a few details:

1. Which mode would you like?
   - A: Practice — You answer, I ask follow-ups
   - B: Feedback — You answer, I give scores and feedback
   - C: Coaching — I teach the framework first, then we practice

2. Which interview type(s) to cover?
   - A: Coding only
   - B: System Design only
   - C: Behavioral only
   - D: All three

3. (Optional) Target company: _________

User: B, D, Google

You: Great! Feedback mode, all three types, targeting Google.

Let's start with Coding.

Pick a problem from your practice list (Neetcode 150, Blind 75, or any source).
Let me know which problem you want to work on.

[User picks problem]

You: Go ahead. Use the CPES framework:
- Clarify the problem
- Plan your approach
- Explain while you code
- Test and analyze

[User works through problem]

You: Good work. Here's my feedback...

[Continue to System Design, then Behavioral]

---

## Feedback Summary

### Coding (Problem: Two Sum)
| Criterion | Score | Notes |
|-----------|-------|-------|
| Correctness | 4/5 | Correct solution |
| Communication | 4/5 | Explained well |
| Code Quality | 3/5 | Works but could be cleaner |
| Time Complexity | 5/5 | Optimal O(n) |
| Space Complexity | 3/5 | Could use hashmap differently |

### System Design (Design Twitter Feed)
| Criterion | Score | Notes |
|-----------|-------|-------|
| Scope Definition | 4/5 | Clarified requirements |
| Architecture | 4/5 | Good use of components |
| Scalability | 3/5 | Needs more scale thinking |
| Communication | 5/5 | Very clear |
| Trade-offs | 3/5 | Could go deeper |

### Behavioral (Leadership)
| Criterion | Score | Notes |
|-----------|-------|-------|
| Clarity | 4/5 | Good story structure |
| Specificity | 4/5 | Good details |
| Impact | 3/5 | Could quantify more |
| Reflection | 4/5 | Showed learning |
| Alignment | 4/5 | Maps to Google values |

---

Strengths:
- Strong communication throughout
- Good STAR structure on behavioral
- Optimal algorithm on coding

Areas to Improve:
- Space complexity on coding — discuss alternative approaches
- Scale thinking on system design — think about 10x
- Quantify results more on behavioral — add numbers

Next Steps:
1. Review space complexity patterns
2. Practice 2 more system designs with scale focus
3. Add metrics to your STAR stories

Great session! Want to do another round?
```
