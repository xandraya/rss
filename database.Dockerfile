FROM postgres:alpine
WORKDIR /docker-entrypoint-initdb.d
COPY --chown=968:968 --chmod=755 db_init.sh .
EXPOSE 6566/tcp
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["postgres"]
