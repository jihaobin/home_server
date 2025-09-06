# 在已安装了postgis扩展的postgresql镜像上扩展pgroonga 插件
FROM  imresamu/postgis:17-3.5-bookworm

# 切换到root用户确保有权限执行安装命令
USER root

# 更新包列表并安装pgroonga插件
RUN apt-get update && \
    apt-get install -y ca-certificates lsb-release wget gnupg && \
    # 添加PostgreSQL官方APT仓库
    wget -O /usr/share/keyrings/pgdg.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc && \
    echo "deb [signed-by=/usr/share/keyrings/pgdg.asc] http://apt.postgresql.org/pub/repos/apt $(lsb_release --codename --short)-pgdg main" > /etc/apt/sources.list.d/pgdg.list && \
    # 添加Groonga APT仓库
    wget https://packages.groonga.org/debian/groonga-apt-source-latest-$(lsb_release --codename --short).deb && \
    apt install -y -V ./groonga-apt-source-latest-$(lsb_release --codename --short).deb && \
    apt-get update && \
    # 获取PostgreSQL版本并安装对应的pgroonga包
    PG_VERSION=$(pg_config --version | sed 's/PostgreSQL //g' | sed 's/\..*//g') && \
    apt install -y -V postgresql-17-pgdg-pgroonga && \
    # 清理缓存和临时文件以减小镜像大小
    apt-get autoremove -y && \
    apt-get autoclean && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    rm -rf /var/cache/apt/archives/* && \
    rm -f /tmp/*.deb && \
    rm -f groonga-apt-source-latest-*.deb