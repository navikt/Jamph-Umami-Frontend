# GitHub Copilot instructions

----
applyTo: '**'
---

Do:
- Be direct and concise in your response
- Write code for clarity, not cleverness.
- Follow existing code patterns in the project. And clean code principles.
- Understand that Jamph-Umami-Frontend is a frontend application for Umami Analytics.
- The root folder of the project is "Jamph-Umami-Frontend".
- Rag is here https://jamph-rag-api-umami.ekstern.dev.nav.no/ use VITE_RAG_API_URL to access the RAG API. RAG is the main orcestrator of llm calls. Especially for sql. Rag chooses which llm to usen unless specified.
- Ollama is here https://jamph-ollama.ekstern.dev.nav.no/ use VITE_OLLAMA_URL to access the Ollama API. Ollama is primarily used via RAG, can be used directly for small non sql tasks.
- Prefer minimal, focused changes.
- Avoid guessing when required context is missing.
- When changing a resource that is used by other parts of the codebase, clarify the impact of the change and ask for approval before proceeding.
- Shared resources can be found in the "src/client/shared" folder.
- "src/components/dashboard" is legacy, "src/components/dashboardjson" is the new improved dashboard. Uses json files to create dashboards supports ai decided order of tables(can use ollama directly send: prompt with types of tables list and recive them in order.), and is more flexible.

Don't:
- Add code comments unless explicitly asked to.
- Create documentation files unless explicitly asked to.
- Use verbose and overly polite language.
- Introduce new dependencies without approval.
- Do not use æ, ø, or å in variable names.
- Use local resources or files that are not part of the project.
- Use localhost, local dockers, or any local services in your code.
- Import code from anything called prototype, test, or example, in production files. Duplicate code if necessary, checks "src/client/shared" for shared resources and use that.