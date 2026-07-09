# 在已安装了 PostGIS 扩展的 PostgreSQL 镜像上扩展 PGroonga 插件。
FROM imresamu/postgis:17-3.5-bookworm

USER root

RUN set -eux; \
    printf '%s\n' \
        'Acquire::Retries "5";' \
        'Acquire::http::Timeout "60";' \
        'Acquire::https::Timeout "60";' \
        > /etc/apt/apt.conf.d/80-retries; \
    . /etc/os-release; \
    debian_codename="${VERSION_CODENAME:?}"; \
    pg_major="$(pg_config --version | sed -E 's/^PostgreSQL ([0-9]+).*/\1/')"; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates wget; \
    wget -O /tmp/groonga-apt-source.deb "https://packages.groonga.org/debian/groonga-apt-source-latest-${debian_codename}.deb"; \
    apt-get install -y --no-install-recommends /tmp/groonga-apt-source.deb; \
    apt-get update; \
    apt-get install -y --no-install-recommends "postgresql-${pg_major}-pgdg-pgroonga"; \
    apt-get autoremove -y; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/* /tmp/groonga-apt-source.deb
