Draw the components of our video upload service.

A creator uses the upload app, which talks to the upload API. The API sends jobs to the transcode workers, and the workers write through a storage client into the video store. That is the main path.

Every caption call from the workers passes a rate limiter on its way to the caption model. The storage client also starts thumbnail jobs. Before anything goes public, the API sends the video through a content check, and only a pass reaches the publisher, which writes playback files to the CDN origin.

The app, API, workers, limiter, storage client, content check and publisher run in the upload service. The caption model, video store, thumbnail jobs and CDN origin are managed services on a private network. Both sit inside one cloud account.
