FROM postgres:17-alpine
WORKDIR /docker-entrypoint-initdb.d
COPY --chown=968:968 --chmod=755 db_init.sh .
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["postgres"]
