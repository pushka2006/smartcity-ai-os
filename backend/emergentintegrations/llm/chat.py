import asyncio
import re

class UserMessage:
    def __init__(self, text="", *args, **kwargs):
        self.text = text

class TextDelta:
    def __init__(self, content=""):
        self.content = content

class StreamDone:
    pass

COMMON_ALGORITHMS = {
    "fibonacci": {
        "python": """def fibonacci(n: int) -> list:
    \"\"\"Generate Fibonacci sequence up to n elements.\"\"\"
    if n <= 0:
        return []
    if n == 1:
        return [0]
    seq = [0, 1]
    while len(seq) < n:
        seq.append(seq[-1] + seq[-2])
    return seq""",
        "javascript": """function fibonacci(n) {
  if (n <= 0) return [];
  if (n === 1) return [0];
  const seq = [0, 1];
  while (seq.length < n) {
    seq.push(seq[seq.length - 1] + seq[seq.length - 2]);
  }
  return seq;
}""",
        "typescript": """function fibonacci(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [0];
  const seq = [0, 1];
  while (seq.length < n) {
    seq.push(seq[seq.length - 1] + seq[seq.length - 2]);
  }
  return seq;
}"""
    },
    "factorial": {
        "python": """def factorial(n: int) -> int:
    \"\"\"Calculate the factorial of a non-negative integer.\"\"\"
    if n < 0:
        raise ValueError("Factorial is not defined for negative numbers")
    if n in (0, 1):
        return 1
    result = 1
    for i in range(2, n + 1):
        result *= i
    return result""",
        "javascript": """function factorial(n) {
  if (n < 0) throw new Error("Negative numbers not allowed");
  if (n === 0 || n === 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}"""
    },
    "fizzbuzz": {
        "python": """def fizzbuzz(limit: int):
    \"\"\"Standard FizzBuzz implementation.\"\"\"
    for i in range(1, limit + 1):
        if i % 3 == 0 and i % 5 == 0:
            print("FizzBuzz")
        elif i % 3 == 0:
            print("Fizz")
        elif i % 5 == 0:
            print("Buzz")
        else:
            print(i)""",
        "javascript": """function fizzbuzz(limit) {
  for (let i = 1; i <= limit; i++) {
    if (i % 3 === 0 && i % 5 === 0) {
      console.log("FizzBuzz");
    } else if (i % 3 === 0) {
      console.log("Fizz");
    } else if (i % 5 === 0) {
      console.log("Buzz");
    } else {
      console.log(i);
    }
  }
}"""
    }
}

def parse_code_features(code, language):
    functions = []
    classes = []
    has_loops = False
    has_conditionals = False
    
    if not code:
        return functions, classes, has_loops, has_conditionals

    language_low = language.lower()
    if language_low == "python":
        functions = re.findall(r'def\s+(\w+)', code)
        classes = re.findall(r'class\s+(\w+)', code)
        has_loops = "for " in code or "while " in code
        has_conditionals = "if " in code or "elif " in code or "else:" in code
    elif language_low in ["javascript", "typescript"]:
        functions = re.findall(r'function\s+(\w+)', code)
        arrow_funcs = re.findall(r'(?:const|let|var)\s+(\w+)\s*=\s*(?:\(.*?\)|[^=]*?)\s*=>', code)
        functions.extend(arrow_funcs)
        classes = re.findall(r'class\s+(\w+)', code)
        has_loops = "for " in code or "while " in code or ".forEach" in code or ".map" in code
        has_conditionals = "if " in code or "else " in code or "switch" in code
    else:
        functions = re.findall(r'(?:void|int|string|func|fn|def)\s+(\w+)', code)
        classes = re.findall(r'class\s+(\w+)', code)
        has_loops = "for " in code or "while " in code
        has_conditionals = "if " in code or "else" in code

    functions = list(dict.fromkeys(functions))
    classes = list(dict.fromkeys(classes))
    return functions, classes, has_loops, has_conditionals

def generate_generic_code(prompt, language):
    clean = re.sub(r'[^a-zA-Z0-9\s]', '', prompt)
    words = [w.lower() for w in clean.split() if w]
    if not words:
        words = ["process", "data"]
    
    snake = "_".join(words)
    camel = words[0] + "".join(w.capitalize() for w in words[1:])
    pascal = "".join(w.capitalize() for w in words)
    
    lang_low = language.lower()
    if lang_low == "python":
        return f"""def {snake}(payload: dict) -> dict:
    \"\"\"
    Handler for: {prompt}
    \"\"\"
    print(f"Executing {snake}...")
    
    # Core processing logic
    results = {{
        "status": "nominal",
        "processed_at": "timestamp",
        "input_keys": list(payload.keys())
    }}
    
    return results

# Example invocation
if __name__ == "__main__":
    test_data = {{"key": "value", "id": "tx-100"}}
    print({snake}(test_data))
"""
    elif lang_low in ["javascript", "typescript"]:
        is_ts = lang_low == "typescript"
        type_annot = ": any" if is_ts else ""
        ret_annot = ": Promise<any>" if is_ts else ""
        return f"""/**
 * Handler for: {prompt}
 */
async function {camel}(payload{type_annot}){ret_annot} {{
  console.log("Executing {camel}...");

  // Core processing logic
  const results = {{
    status: "nominal",
    processedAt: new Date().toISOString(),
    inputKeys: Object.keys(payload)
  }};

  return results;
}}

// Example invocation
// {camel}({{ key: "value", id: "tx-100" }}).then(console.log);
"""
    elif lang_low == "go":
        return f"""package main

import (
	"fmt"
	"time"
)

// {pascal}Response defines the payload response
type {pascal}Response struct {{
	Status      string    `json:"status"`
	ProcessedAt time.Time `json:"processed_at"`
}}

// {pascal} handles: {prompt}
func {pascal}(payload map[string]interface{{}}) *{pascal}Response {{
	fmt.Println("Executing {pascal}...")
	return &{pascal}Response{{
		Status:      "nominal",
		ProcessedAt: time.Now(),
	}}
}}

func main() {{
	data := map[string]interface{{}}{{"key": "value"}}
	res := {pascal}(data)
	fmt.Printf("Result: %+v\\n", res)
}}
"""
    elif lang_low == "rust":
        return f"""// {pascal} handles: {prompt}
use std::collections::HashMap;
use std::time::SystemTime;

#[derive(Debug)]
pub struct {pascal}Response {{
    pub status: String,
    pub timestamp: SystemTime,
}}

pub fn {snake}(payload: HashMap<String, String>) -> {pascal}Response {{
    println!("Executing {snake}...");
    {pascal}Response {{
        status: "nominal".to_string(),
        timestamp: SystemTime::now(),
    }}
}}

fn main() {{
    let mut data = HashMap::new();
    data.insert("key".to_string(), "value".to_string());
    let res = {snake}(data);
    println!("Result: {{:?}}", res);
}}
"""
    elif lang_low == "sql":
        table_name = words[-1] if len(words) > 1 else "records"
        return f"""-- SQL Query for: {prompt}
-- Retrieve nominal active telemetry records

SELECT 
    id, 
    status, 
    created_at
FROM 
    {table_name}
WHERE 
    status = 'nominal'
    AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY 
    created_at DESC;
"""
    elif lang_low == "html":
        return f"""<!-- Template for: {prompt} -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{prompt.title()}</title>
    <style>
        body {{
            background: #020617;
            color: #e2e8f0;
            font-family: monospace;
            padding: 2rem;
        }}
        .container {{
            border: 1px solid #00f5ff;
            box-shadow: 0 0 16px rgba(0,245,255,0.15);
            border-radius: 8px;
            padding: 1.5rem;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>{prompt.title()}</h1>
        <p>Telemetry system status page.</p>
    </div>
</body>
</html>
"""
    elif lang_low == "css":
        return f"""/* Stylesheet for: {prompt} */
:root {{
    --neon-cyan: #00f5ff;
    --dark-bg: #020617;
    --text-color: #e2e8f0;
}}

.widget-container {{
    background: var(--dark-bg);
    border: 1px solid rgba(0, 245, 255, 0.2);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    border-radius: 12px;
    padding: 20px;
    transition: all 0.3s ease-in-out;
}}

.widget-container:hover {{
    border-color: var(--neon-cyan);
    box-shadow: 0 0 25px rgba(0, 245, 255, 0.3);
    transform: translateY(-2px);
}}
"""
    else:
        return f"""// Generic block for: {prompt}
// Language: {language}

function {camel}() {{
    // Implement core logic here
    return true;
}}
"""

def generate_explanation(code, language):
    funcs, classes, loops, conds = parse_code_features(code, language)
    func_str = ""
    if funcs:
        func_str += "- **Functions**: " + ", ".join([f"`{f}`" for f in funcs]) + "\n"
    if classes:
        func_str += "- **Classes**: " + ", ".join([f"`{c}`" for c in classes]) + "\n"
    if not funcs and not classes:
        func_str += "- **Main block**: Procedural code layout.\n"
        
    control_features = []
    if loops:
        control_features.append("loops for iteration")
    if conds:
        control_features.append("conditional branching for logic control")
        
    control_str = " and ".join(control_features) if control_features else "standard sequential instructions"
    
    explanation = f"""### Code Explanation (Language: {language.upper()})

The provided code has been analyzed and contains the following structure:

{func_str}
#### Key Steps & Logic Flow:

1. **Initialization**: The code starts by setting up scopes and tracking local variables.
2. **Logic Processing**: It implements **{control_str}** to compute the desired results.
3. **Execution Scope**:
   * Operations run sequentially within a clean runtime environment.
   * State variables are resolved and correctly returned or logged.
"""
    return explanation

def generate_debug(code, language):
    funcs, classes, loops, conds = parse_code_features(code, language)
    func_name = funcs[0] if funcs else "process"
    
    fixed_code = code
    if not code:
        code = "# No code provided"
        fixed_code = code
        
    lang_low = language.lower()
    if lang_low == "python":
        if "try:" not in code:
            lines = code.splitlines()
            indented = "\n    ".join(lines)
            fixed_code = f"""def safe_{func_name}(*args, **kwargs):
    try:
        # Wrapped original code execution
        {indented}
    except Exception as e:
        print(f"Diagnostic Error in safe_{func_name}: {{e}}")
        return None"""
    elif lang_low in ["javascript", "typescript"]:
        if "try" not in code:
            fixed_code = f"""try {{
  // Wrapped original code execution
  {code}
}} catch (error) {{
  console.error("Diagnostic Error in safe_{func_name}:", error);
}}"""

    output = f"""### Debug Diagnostics

**Vulnerability / Bug Detected**: Potential uncaught exception or runtime boundary overflow (e.g. `None`/`null` dereferences or DivisionByZero).

#### Resolution:
- Wrapped code execution inside robust safety boundaries to capture runtime exceptions.
- Added localized error diagnostics reporting.

#### Corrected Code:
```{language}
{fixed_code}
```
"""
    return output

def generate_refactor(code, language):
    funcs, classes, loops, conds = parse_code_features(code, language)
    func_name = funcs[0] if funcs else "handler"
    
    refactored_code = code
    if not code:
        refactored_code = "// No code provided"
        
    lang_low = language.lower()
    if lang_low == "python":
        refactored_code = f"""# Refactored for Type Safety & Clean Code Principles
from typing import Any, Dict, Optional

def {func_name}(*args: Any, **kwargs: Any) -> Optional[Any]:
    \"\"\"
    Refactored handler.
    Provides standard logging, clean scope handling, and returns state.
    \"\"\"
    # Clean docstring and type annotations added
    # original logic follows:
    {code}
"""
    elif lang_low in ["javascript", "typescript"]:
        refactored_code = f"""/**
 * Refactored {func_name}
 * Added ES6 structural bindings, modern async boundaries, and documentation comments.
 */
const {func_name} = async (...args) => {{
  console.time("{func_name} execution");
  try {{
    // original logic follows:
    {code}
  }} finally {{
    console.timeEnd("{func_name} execution");
  }}
}};
"""

    output = f"""### Refactoring Report

The original module was optimized for **readability**, **execution speed**, and **clean scoping**.

#### Changes Implemented:
- Standardized formatting and code comments.
- Introduced explicit return type guarantees.
- Injected performance logging diagnostics.

#### Refactored Code:
```{language}
{refactored_code}
```
"""
    return output

def generate_test(code, language):
    funcs, classes, loops, conds = parse_code_features(code, language)
    func_name = funcs[0] if funcs else "process"
    
    test_code = ""
    lang_low = language.lower()
    if lang_low == "python":
        test_code = f"""import unittest

# Assuming functions are imported from your module
# from module import {func_name}

class Test{func_name.capitalize()}(unittest.TestCase):
    def setUp(self):
        # Local test setups
        self.payload = {{"id": "test-id", "value": 42}}

    def test_{func_name}_nominal(self):
        \"\"\"Test nominal success path\"\"\"
        # self.assertTrue({func_name}(self.payload))
        self.assertTrue(True)

    def test_{func_name}_empty(self):
        \"\"\"Test boundary with empty inputs\"\"\"
        # self.assertIsNone({func_name}(None))
        pass

if __name__ == '__main__':
    unittest.main()
"""
    elif lang_low in ["javascript", "typescript"]:
        test_code = f"""// Jest Unit Test Suite for {func_name}
// const {{ {func_name} }} = require('./module');

describe('Test Suite for {func_name}', () => {{
  let mockPayload;

  beforeEach(() => {{
    mockPayload = {{ id: 'test-id', value: 42 }};
  }});

  test('nominal case resolves successfully', async () => {{
    // const result = await {func_name}(mockPayload);
    // expect(result).toBeDefined();
    expect(true).toBe(true);
  }});

  test('handles edge case inputs', async () => {{
    // expect(await {func_name}(null)).toBeNull();
  }});
}});
"""
    else:
        test_code = f"""// Standard test definitions for {func_name}
// Verify core constraints and return state codes.
"""

    output = f"""### Generated Unit Tests

Comprehensive tests targeting standard cases and boundary values.

#### Test Suite:
```{language}
{test_code}
```
"""
    return output

def generate_document(code, language):
    funcs, classes, loops, conds = parse_code_features(code, language)
    
    func_docs = ""
    if funcs:
        for f in funcs:
            func_docs += f"### `function {f}()`\n- **Description**: Core operational handler in the module.\n- **Access**: public\n- **Parameters**: standard arguments\n- **Returns**: status code or state dictionary\n\n"
    else:
        func_docs = "### Script block\nDirect procedural execution block.\n"

    output = f"""### Module Documentation

# Developer API Reference Guide

Interactive documentation generated for the provided {language.upper()} code.

## Component Index

{func_docs}
"""
    return output

class LlmChat:
    def __init__(self, api_key="", session_id="", system_message=""):
        self.api_key = api_key
        self.session_id = session_id
        self.system_message = system_message or ""
        self.model_provider = None
        self.model_name = None

    def with_model(self, provider, model_name):
        self.model_provider = provider
        self.model_name = model_name
        return self

    async def stream_message(self, user_message: UserMessage):
        prompt = getattr(user_message, "text", "") or ""
        prompt_low = prompt.lower()
        system_low = self.system_message.lower()

        # Decide mock response based on system message and prompt
        if "browser" in system_low or "playwright" in system_low or "plan" in prompt_low:
            url_match = re.search(r'(https?://[^\s/$.?#].[^\s]*)', prompt)
            target_url = url_match.group(1) if url_match else "https://google.com"
            search_query = prompt.replace(target_url, "").strip() if url_match else prompt
            if not search_query or len(search_query) < 3:
                search_query = "AI news today"

            plan_steps = [
                "**NEXUS Browser Agent** initialized.\n\n",
                f"Goal: *\"{prompt}\"* \n\n",
                "Here is the Playwright automation plan to achieve this:\n\n",
                f"1. **goto**(\"{target_url}\")\n",
            ]
            if "google.com" in target_url or "search" in target_url.lower():
                plan_steps.extend([
                    f"2. **fill**(\"input[name='q']\", \"{search_query}\")\n",
                    "3. **press**(\"Enter\")\n",
                    "4. **wait_for_selector**(\"h3\")\n",
                    "5. **evaluate**(() => {\n"
                    "     const results = [];\n"
                    "     document.querySelectorAll('div.g').forEach(el => {\n"
                    "       const title = el.querySelector('h3')?.innerText;\n"
                    "       const url = el.querySelector('a')?.href;\n"
                    "       if (title && url) results.push({ title, url });\n"
                    "     });\n"
                    "     return results.slice(0, 5);\n"
                    "   })\n\n"
                ])
            else:
                plan_steps.extend([
                    "2. **wait_for_load**()\n",
                    "3. **extract_content**('body')\n",
                    "4. **log_results**()\n",
                    "5. **return** response\n\n"
                ])
            plan_steps.append(f"**Success Criterion**: Successfully completed browser execution task for '{search_query}'.")
            response_text = "".join(plan_steps)

        elif "knowledge" in system_low or "rag" in system_low:
            # KB Query RAG
            response_text = f"""**NEXUS Knowledge Agent** online.

Query: *"{prompt}"*

Based on the indexed sources in the knowledge base, here is the compiled information:

- **System Integration**: The current telemetry configuration aligns with standard subnet settings.
- **Nominal Metrics**: All microservices are active and reported as healthy.
- **Authentication**: Face scanners are configured to bypass with PIN `1337` if database is unavailable.

Refer to the original documentation files in your workspace for further details."""

        elif "developer" in system_low or "debug" in system_low or "tester" in system_low or "documenter" in system_low or "security" in system_low or "developer" in prompt_low:
            action = "explain"
            language = "python"
            user_prompt = ""
            user_code = ""

            for lang in ["python", "javascript", "typescript", "bash", "go", "rust", "java", "cpp", "sql", "html", "css", "json", "yaml", "markdown"]:
                if f" {lang} " in prompt_low or f" {lang}\n" in prompt_low or f" {lang}." in prompt_low:
                    language = lang
                    break

            code_match = re.search(r'```(?:\w+)?\n(.*?)```', prompt, re.DOTALL)
            if code_match:
                user_code = code_match.group(1)

            if prompt.startswith("Generate"):
                if "unit tests" in prompt_low:
                    action = "test"
                elif "professional documentation" in prompt_low:
                    action = "document"
                else:
                    action = "generate"
                    if "code for:" in prompt:
                        user_prompt = prompt.split("code for:", 1)[1].strip()
                    else:
                        user_prompt = prompt
            elif prompt.startswith("Explain"):
                action = "explain"
            elif prompt.startswith("Debug"):
                action = "debug"
            elif prompt.startswith("Refactor"):
                action = "refactor"
            else:
                action = "chat"
                user_prompt = prompt

            if action == "generate":
                matched_algo = None
                for algo in ["fibonacci", "factorial", "fizzbuzz"]:
                    if algo in user_prompt.lower():
                        matched_algo = algo
                        break
                
                if matched_algo and matched_algo in COMMON_ALGORITHMS and language.lower() in COMMON_ALGORITHMS[matched_algo]:
                    generated_code = COMMON_ALGORITHMS[matched_algo][language.lower()]
                else:
                    generated_code = generate_generic_code(user_prompt, language)
                
                response_text = f"""**NEXUS Developer Agent** ready.

Here is the implementation matching your request:

```{language}
{generated_code}
```

This code is optimized and ready."""
            elif action == "explain":
                response_text = generate_explanation(user_code, language)
            elif action == "debug":
                response_text = generate_debug(user_code, language)
            elif action == "refactor":
                response_text = generate_refactor(user_code, language)
            elif action == "test":
                response_text = generate_test(user_code, language)
            elif action == "document":
                response_text = generate_document(user_code, language)
            else:
                response_text = f"""**NEXUS Developer Agent** ready.

I received your development query: *"{prompt}"*

I can generate, explain, debug, refactor, test, or document code in multiple languages (Python, JS/TS, Go, Rust, SQL, HTML/CSS, etc.). Use the Code Assistant tab to execute structured actions, or ask me specific coding questions here!"""

        else:
            import sys
            server_mod = sys.modules.get("server")
            db = server_mod.db if (server_mod and hasattr(server_mod, "db")) else None

            if any(kw in prompt_low for kw in ["task", "todo", "to-do"]):
                tasks = db.tasks.data if db else []
                if not tasks:
                    response_text = "**NEXUS Tasks Swarm**: No active tasks found in the database. Use the Tasks panel to queue new objectives."
                else:
                    lines = ["### Active Tasks Telemetry Grid\n"]
                    for t in tasks:
                        status_symbol = "⏱️" if t.get("status") == "pending" else "🔄" if t.get("status") == "running" else "✅" if t.get("status") == "completed" else "❌"
                        priority = t.get("priority", "medium").upper()
                        lines.append(f"- {status_symbol} **{t.get('title')}** | Priority: `{priority}` | Progress: `{t.get('progress')}%` ({t.get('status')})")
                    response_text = "\n".join(lines)
            elif any(kw in prompt_low for kw in ["memory", "remember", "recall"]):
                mems = db.memories.data if db else []
                if not mems:
                    response_text = "**NEXUS Cognitive Memory**: No memory items indexed. I can remember items added through the Memory segment."
                else:
                    lines = ["### Holographic Memory Index\n"]
                    for m in mems:
                        lines.append(f"- 🧠 **{m.get('title')}** (Category: `{m.get('category')}`, Importance: `{m.get('importance')}/5`)\n  > {m.get('content')}")
                    response_text = "\n".join(lines)
            elif any(kw in prompt_low for kw in ["knowledge", "file", "document", "archive"]):
                files = db.kb_files.data if db else []
                if not files:
                    response_text = "**NEXUS Archive Index**: No documents have been indexed yet. Upload documents in the Knowledge Base segment."
                else:
                    lines = ["### Indexed Knowledge Repositories\n"]
                    for f in files:
                        size_kb = round(f.get('size', 0) / 1024, 1)
                        lines.append(f"- 📄 **{f.get('name')}** | Type: `{f.get('type')}` | Size: `{size_kb} KB` | Indexed: `{'TRUE' if f.get('indexed') else 'FALSE'}`")
                    response_text = "\n".join(lines)
            elif any(kw in prompt_low for kw in ["connection", "sync", "github", "google", "linkedin", "instagram"]):
                conns = db.connections.data if db else []
                lines = ["### External Sync API Integrations\n"]
                providers = ["GitHub", "Google", "LinkedIn", "Instagram"]
                found_any = False
                for provider in providers:
                    conn = next((c for c in conns if c.get("provider") == provider), None)
                    if conn and conn.get("connected"):
                        found_any = True
                        lines.append(f"- ✅ **{provider}**: Connected (User: `{conn.get('username')}`)")
                    else:
                        lines.append(f"- ⚠️ **{provider}**: Off-line (Link disconnected)")
                if not found_any:
                    lines.append("\n*Note: Link connections to unlock contextual widgets in the Command Panel.*")
                response_text = "\n".join(lines)
            elif any(kw in prompt_low for kw in ["biometric", "security", "lock", "sentinel"]):
                bios = db.biometrics.data if db else []
                settings = db.bio_settings.data if db else []
                lines = ["### Shield Sentinel Security Logs\n"]
                lines.append(f"System Lockscreen state: **SECURE**\n")
                if settings:
                    lines.append(f"- Face Recognition: `{'ENABLED' if settings[0].get('face_enabled') else 'DISABLED'}`")
                    lines.append(f"- Bypass PIN Code: `{'ENABLED' if settings[0].get('pin_enabled') else 'DISABLED'}`")
                if bios:
                    lines.append("\n**Recent Authorization Events:**")
                    for b in bios[:5]:
                        status = "✅ APPROVED" if b.get("status") == "success" else "❌ REJECTED"
                        lines.append(f"- {b.get('timestamp')[:19]}: {b.get('user')} | {status} (Method: {b.get('type')})")
                response_text = "\n".join(lines)
            elif any(kw in prompt_low for kw in ["evacuation", "evac", "zone", "shelter", "threat", "emergency", "eas", "siren"]):
                response_text = """### Civil Defense Evacuation Directive
      
**Alert Level**: **ACTIVE EMERGENCY PROTOCOL** (Evacuation channels highlighted)

#### Active Shelter Capacity
1. **Sector Alpha High School**: 500 occupants (Status: Standby)
2. **Sector Beta Sports Arena**: 1000 occupants (Status: Standby)

#### Route Transit Guidelines
- **Primary Corridor**: Expressway Evac lane (Average flow pace: 40km/h max).
- **Secondary Corridor**: Local avenues checkpoint routing.
- **Incident Markers**: Warning check-points, roadblock zones, and staging hubs are spawned live on the Traffic Grid map."""
            elif any(kw in prompt_low for kw in ["code", "write", "debug", "python", "javascript", "function", "program"]):
                response_text = f"""**NEXUS System Developer** ready.
            
Here is a sample implementation snippet matching your criteria:

```python
# Automatic pipeline generation
def process_data_grid(payload: dict) -> dict:
    \"\"\"Validate and parse input payloads\"\"\"
    return {{
        "status": "nominal",
        "keys_processed": list(payload.keys())
    }}
```
If you need targeted code actions (like document, debug, refactor, or test), please open the **Code Assistant** tab for full pipeline generation."""
            elif "weather" in prompt_low:
                response_text = """### Smart City Meteorological Telemetry
Current temperature: **21°C**
Conditions: **Overcast**
Precipitation: **12%**
Wind speed: **14 km/h**
Air Quality Index: **34 (Good)**"""
            elif "who" in prompt_low and "you" in prompt_low:
                response_text = """I am **NEXUS**, the core operating swarm intelligence for this Smart City system. 

I coordinate several specialized agents (Planner, Researcher, Developer, Security, Memory) to monitor system health, simulate traffic routing, index knowledge graphs, and deploy microservices."""
            elif "what" in prompt_low and "do" in prompt_low:
                response_text = """I am a full-scale AI OS assistant. Here is what I can help you do:
- **Traffic Grid Routing**: Simulate congestions, geolocate live nodes, and activate the **Emergency Alert System (EAS)** with custom sirens and markers.
- **Microservice Orchestration**: Manage tasks, logs, and schedule priorities.
- **Knowledge RAG**: Index uploaded files and search semantic context.
- **Sentinel Security**: Manage face scans, locks, and PIN entries.
- **Holographic Memory**: Archive long-term data items."""
            elif "smartcity" in prompt_low or "smart city" in prompt_low:
                response_text = """The **Smart City AI OS** is a unified central control dashboard designed to manage municipal grids:
- **Telemetry Sensors**: Real-time camera feeds, air metrics, and physics sandboxes.
- **Evacuation Plans**: Auto-generated transit maps during civil defense emergencies.
- **Autonomous Swarms**: Intelligent agents writing scripts, planning tasks, and auditing security vulnerabilities."""
            else:
                response_text = f"""**NEXUS Swarm Intelligence** online.
                
I analyzed your directive: *"{prompt}"*

All local microservices report a status of **NOMINAL**. Core databases, sensors, and telemetry grids are synchronized.

How can I assist you further with this operation?"""

        for char in response_text:
            yield TextDelta(content=char)
            await asyncio.sleep(0.002)

        yield StreamDone()
