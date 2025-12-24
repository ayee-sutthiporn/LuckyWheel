FROM nginx:alpine
COPY . /srv/apps/lucky_wheel
COPY lucky_wheel.conf /etc/nginx/conf.d/lucky_wheel.conf
