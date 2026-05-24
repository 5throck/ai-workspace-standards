import os
import re

projects = [
    "C:/git",
    "C:/git/templates",
    "C:/git/abap_vibe_coding",
    "C:/git/abap_vibe_coding_plugin",
    "C:/git/Pricing-Mgmt-Simulation",
    "C:/git/quickdl"
]

new_block = """#### Superpowers Plugin & Cost Optimization (3-Tier Strategy)
The PM agent MUST leverage the **`superpowers`** plugin (e.g., `subagent-driven-development`, `dispatching-parallel-agents`) for multi-agent harness engineering using a 3-tier model strategy:
**Model Selection Overrides** (overridden per subagent invocation when appropriate):
- **High-tier (Design/Planning)** → `gemini-3.1-pro` (Parameter: `thinking_level="medium"`): Complex reasoning, architectural design, planning, and PM orchestration.
- **Medium-tier (Review/QA)** → `gemini-3.5-flash` (Parameter: `thinking_level="medium"`): Code review, testing, PR review, and quality gates (`verification-before-completion`). Supervises the Low-tier.
- **Low-tier (Execution/Coding)** → `gemini-3.5-flash` (Parameter: `thinking_level="low"`): Fast, repetitive coding, boilerplate generation, or strictly scoped sub-agent tasks.
"""

for proj in projects:
    gemini_file = os.path.join(proj, "GEMINI.md")
    if os.path.exists(gemini_file):
        with open(gemini_file, "r", encoding="utf-8", newline='') as f:
            content = f.read()
        
        # Check if block exists
        if "#### Superpowers Plugin & Cost Optimization" in content:
            # Replace existing block
            pattern = re.compile(r"#### Superpowers Plugin & Cost Optimization.*?tasks\.", re.DOTALL)
            content = re.sub(pattern, new_block.strip(), content)
            print(f"Updated existing block in {gemini_file}")
        else:
            # Insert after Communication section
            if "#### Communication (`send_message`)" in content:
                parts = content.split("#### Communication (`send_message`)")
                # parts[1] has the rest. We find the next `---`
                subparts = parts[1].split("\n---", 1)
                if len(subparts) == 2:
                    content = parts[0] + "#### Communication (`send_message`)" + subparts[0] + "\n\n" + new_block + "\n---" + subparts[1]
                    print(f"Inserted new block into {gemini_file}")
                else:
                    print(f"Failed to find --- marker in {gemini_file}")
            else:
                print(f"Failed to find Communication section in {gemini_file}")
        
        with open(gemini_file, "w", encoding="utf-8", newline='') as f:
            f.write(content)

print("All GEMINI.md files updated with thinking_level parameters.")
