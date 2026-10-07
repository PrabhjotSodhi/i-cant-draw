Draw our image upload pipeline in three phases.

Processing: an upload manifest feeds the resize worker, which makes every image size. The worker reads the original images from storage. An overlay builder combines three brand assets, the brand logos, the font library and the colour profiles, and the worker applies those overlays. The worker produces the image variants.

Quality control: an image check looks at each variant. If the check fails, a re-encode step encodes it again and sends it back to the variants. If it passes, the variants are ready.

Human review, top to bottom: a moderator reviews the ready variants, and the approved ones become published images served from the CDN.
