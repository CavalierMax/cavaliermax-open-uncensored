# Cavaliermax Open Uncensored

Dashboard statica per confrontare modelli AI con OpenRouter. La UI **Command Deck** è un design originale Cavaliermax: console editoriale-operativa, non derivata da layout, asset o codice di altri progetti.

## Stato del prototipo

I modelli vengono caricati dal catalogo live di OpenRouter: nome, provider, contesto e prezzi non sono hard-coded. Accuratezza, ragionamento, affidabilità, grafici e ranking restano **N/D** finché una futura suite di benchmark non produrrà dati misurati. Le richieste nella sezione GODMODE sono reali quando l'utente inserisce la propria API key OpenRouter e seleziona uno o più modelli.

Il catalogo offre filtri per provider, famiglia, capacità dichiarate, gratuità, novità, context window, max output, fissati, latenza di sessione e modelli probabilmente uncensored. Il filtro uncensored è euristico e non è una garanzia. Prezzi, context e data provengono dall'API; rapporto costo/prestazioni resta disabilitato finché non esistono benchmark misurati. I risultati sono paginati a 15, 25 o 50 modelli per pagina.

## Avvio locale su Windows

1. Installa Python 3 se non è già presente.
2. Avvia `start-windows.bat`.
3. Apri `http://127.0.0.1:8765/` se il browser non si avvia automaticamente.

La chiave OpenRouter non viene inserita in file versionati. Se selezioni “Ricorda su questo browser”, viene conservata esclusivamente nel `localStorage` del profilo browser e separatamente per ogni URL/origine; usa questa opzione solo su un dispositivo personale.

Per aprire la dashboard ospitata sul server AI dal PC Windows, avvia `Open-GodModeOpenrouter.bat`. Usa una finestra Firefox isolata; chiudendo quella finestra si chiude anche il terminale del launcher.

## Avvio su Linux (LAN)

Da una directory di deploy posseduta dall'utente dell'applicazione:

```bash
chmod 750 start-linux.sh stop-linux.sh
./start-linux.sh
```

Il launcher predefinito espone solo `http://192.168.1.144:8786/`, salva PID e log nella stessa directory dell'app e non richiede privilegi sudo. Per arrestare il processo: `./stop-linux.sh`.

## Sicurezza

- Usa una API key dedicata, con limite di spesa.
- Non usare chiavi di gestione nell'interfaccia browser.
- Prima del deploy su un server Linux, definire e approvare il percorso di installazione. Nessun file del server deve essere modificato fuori dalla directory assegnata.

## Licenza

Da definire prima della pubblicazione GitHub. Questo progetto è implementato da zero e non include codice, asset, testi o struttura UI del repository di riferimento valutato in fase di analisi.
