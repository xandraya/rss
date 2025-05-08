FROM node:alpine
USER 1000:1000
WORKDIR /app
COPY --chown=1000:1000 .temp ./.temp
COPY --chown=1000:1000 package.json package-lock.json .
RUN --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000 \
	npm install
COPY --chown=1000:1000 src ./src
COPY --chown=1000:1000 test ./test
COPY --chown=1000:1000 jest.config.ts tsconfig.json .env .
ENTRYPOINT ["npm", "run", "test"] 
