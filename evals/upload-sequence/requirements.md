Draw what happens when the phone app uploads a photo.

The app posts the photo to the API gateway, which forwards the request to the upload service. The upload service checks the file type and measures the size. A photo over 5MB goes to object storage first, and then a reference event goes to the message queue. A smaller photo goes to the message queue directly. Both paths return 202 Accepted to the app.
