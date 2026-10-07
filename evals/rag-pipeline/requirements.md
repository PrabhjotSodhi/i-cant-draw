# RAG Pipeline

Create a diagram showing a RAG (Retrieval Augmented Generation) pipeline with three phases.

Knowledge Ingestion Phase (group, left side):
- Two input sources: Domain Specific Language (DSL) and Specifications & Documentation
- Both feed down into Data Pre-processing & Chunking
- That flows into an Embedding Model
- The Embedding Model flows into a Vector Database / Knowledge Index (data source)

Inference & Orchestration Phase (group, middle):
- A User Scenario / Query / End Goal input at top
- Feeds into a Processor / Orchestrator (agent)
- The Vector Database connects to the Processor via RAG context retrieval (dashed)
- The Processor feeds down to Output Generation

Quality Control Phase (group, right side):
- Output Generation flows into an LLM Judge (Validator) diamond
- If validation fails, Error Feedback Loop sends back to the Processor / Orchestrator for another pass
- If validation passes, Final Done State is reached

Human-in-the-loop (vertical group, far right):
- From Final Done State to Human Expert Review
- Then to Verified Production Output
