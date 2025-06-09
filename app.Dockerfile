FROM node:alpine
USER 1000:1000
WORKDIR /app
COPY --chown=1000:1000 package.json package-lock.json .
RUN --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000 \
	npm install
COPY --chown=1000:1000 key ./key
COPY --chown=1000:1000 data ./data
COPY --chown=1000:1000 src ./src
COPY --chown=1000:1000 tsconfig.json .env .
EXPOSE 8080/tcp
ENTRYPOINT ["sh", "-c", "npm run start"] 
