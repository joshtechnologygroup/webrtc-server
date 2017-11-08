# webrtc-server
This repo consists of two apps:

1. calyx_collider: A signalling server based on collider.
1. web_app: Html and Js files needed to test and use collider.

Calyx Collider Setup:
---
See README of original collider: [here](https://github.com/webrtc/apprtc/tree/v1.1/src/collider)

WebApp Setup:
---
1. Create symbolic link of web_app directory in $GOPATH/src.

        ln -s ~/Calyx/webrtc-server/web_app $GOPATH/src
        
Running server and web_app:
---
1. Run Server with this command:
        
        $GOPATH/bin/collidermain -port=8089 -tls=true -room-server=https://<your_ip>
        