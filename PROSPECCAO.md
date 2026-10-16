# Melhorias de prospecção

- Mapa inicia sem cidade fixa. Em HTTPS, solicita localização do navegador somente ao clicar em Usar minha localização; guarda a última localização neste navegador e permite digitar qualquer outro local. As coordenadas aproximadas são consultadas no OpenStreetMap/Nominatim para preencher bairro/cidade. Se a permissão for negada, o local continua manual.
- Cards do painel alternam com/sem/todos e podem ser combinados. Nota oferece limites abaixo de 3, 4 e 4,5; notas ausentes não são notas baixas. O card Empresas limpa os filtros. Contagens dos cards são totais da busca; o contador da lista mostra a interseção dos filtros.
- WhatsApp é estimado pelo padrão de celular brasileiro, sem verificar conta ativa. Site corresponde ao endereço informado pelo Maps (pode ser uma rede social).
- Seleção individual, todas as visíveis ou nenhuma. Seleção persiste ao filtrar; o contador distingue selecionadas e visíveis. Buscar e-mails visita somente sites das selecionadas e até duas páginas de contato/sobre, em sequência. Não refaz consultas no Maps. Até 500 selecionadas por pedido.
- Resultados adicionais são persistidos no volume enrichment_data e aparecem no painel, mapa e exportações formatadas. CSV completo continua sendo o original do Maps. Ausência de site, falhas e nenhum e-mail público encontrado são informados por empresa.
- Serviço Python stdlib isolado: 0,25 CPU, 128 MB RAM, sem porta publicada, raiz somente leitura, sem capabilities e logs limitados. Sites e redirecionamentos precisam resolver exclusivamente em IPs públicos, com conexão presa ao IP validado e TLS validado.

## Verificação

```powershell
node --test tests/prospecting.test.cjs
python -m unittest discover -s tests
node --check frontend/painel.js
node --check frontend/app.js
```

```bash
docker compose config
docker compose up -d
docker compose exec web nginx -t
```

A geolocalização depende de HTTPS e da autorização no navegador. Tailscale Serve pode oferecer HTTPS privado sem exposição pública. Não habilite Funnel.

