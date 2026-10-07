Draw how Netflix's Video Encoding Service on Cosmos encodes one video. The workflow orchestrator sends a request to the Optimus API. A splitter cuts the video into chunks, encoders work on the chunks in parallel as Stratum functions on Titus, an assembler stitches them together, a validator checks the result with the Video Validation Service, and a notifier reports completion.

Sources:

- Netflix Technology Blog, The Making of VES, April 2024: https://netflixtechblog.com/the-making-of-ves-the-cosmos-microservice-for-netflix-video-encoding-946b9b3cd300
