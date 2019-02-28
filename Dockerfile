FROM ubuntu:bionic

RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
        gpg \
        gpg-agent \
        git \
        build-essential \
        fonts-hanazono \
        fonts-noto-cjk \
        fonts-noto-hinted \
        fonts-noto-unhinted \
        mapnik-utils \
        ttf-unifont \
        fontconfig \
        python3-mapnik \
        python3-pil \
        python3-gdal \
        gdal-bin \
    && curl -sL -o /usr/share/fonts/truetype/noto/NotoEmoji-Regular.ttf https://github.com/googlei18n/noto-emoji/raw/master/fonts/NotoEmoji-Regular.ttf \
    && fc-cache -rv \
    && curl -sL https://deb.nodesource.com/setup_10.x | bash - \
    && apt-get install -y nodejs

WORKDIR /wetsaw
RUN (curl -sL https://github.com/restjohn/node-wetsaw/archive/master.tar.gz | tar --strip-components=1 -x -z) && npm install

ENTRYPOINT [ "node", "index.js" ]
