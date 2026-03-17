Name:           idmart-agent
Version:        %{version}
Release:        1%{?dist}
Summary:        IDMatr cross-platform identity and SaaS discovery agent

License:        Proprietary
URL:            https://idmart.io
Source0:        idmart-agent-%{version}.tar.gz

BuildRequires:  golang >= 1.22
Requires:       systemd

%description
The IDMatr Agent discovers installed applications, running processes, SaaS
service usage, user privileges, and device security posture. Telemetry is
forwarded to the IDMatr Identity Security Platform for analysis.

%prep
%setup -q

%build
export GOPATH=%{_builddir}/go
GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w -X main.Version=%{version}" \
    -o idmart-agent \
    ./cmd/agent

%install
install -D -m 755 idmart-agent          %{buildroot}/opt/idmart/idmart-agent
install -D -m 644 packaging/linux/idmart-agent.service \
                                         %{buildroot}%{_unitdir}/idmart-agent.service
install -D -m 644 agent.yaml.example    %{buildroot}/etc/idmart/agent.yaml.example

%pre
# Create required directories if they don't exist.
mkdir -p /opt/idmart /etc/idmart /var/log/idmart /var/lib/idmart/queue

%post
%systemd_post idmart-agent.service

%preun
%systemd_preun idmart-agent.service

%postun
%systemd_postun_with_restart idmart-agent.service

%files
/opt/idmart/idmart-agent
%{_unitdir}/idmart-agent.service
%config(noreplace) /etc/idmart/agent.yaml.example

%changelog
* Thu Jan 01 2026 IDMatr <support@idmart.io> - 1.0.0-1
- Initial release
