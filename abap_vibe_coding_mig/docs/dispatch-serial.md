# Serial Dispatch Template

Use this template when dispatching subagents that must run sequentially.

## When to Use

- Write operations (EditSource, WriteSource)
- Tasks that depend on previous agent output
- Verification chains (code -> test -> review)

## Template

```
# Step 1: [Agent 1 task]
Agent(
  description = "Brief description",
  prompt = """You are a [role]. Task: [specific task].

Output: [what to produce]
""",
  subagent_type = "claude"
)

# Wait for result, then...

# Step 2: [Agent 2 task - depends on Step 1]
Agent(
  description = "Brief description",
  prompt = """You are a [role]. Task: [specific task].

Previous output: [paste result from Step 1]

Output: [what to produce]
""",
  subagent_type = "claude"
)
```

## Important

- Each agent waits for previous to complete
- Pass previous output as context
- One tool call per agent
