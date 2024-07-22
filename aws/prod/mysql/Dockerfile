FROM mysql:8.0

# Copy the custom my.cnf to the container
COPY my.cnf /etc/mysql/my.cnf

# Ensure the MySQL server starts as the main process
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["mysqld"]
