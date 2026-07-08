#!/usr/bin/env python3
"""
SOSGOUV : reconstruit index.html (version design) depuis le code source
publié de la maquette Webflow (sosgouv.webflow.io).

Usage : python3 tools/build_index.py <source.html> [sortie.html]
Le fichier source est le code HTML de la page (affichage du code source
du navigateur, éventuellement converti depuis un .rtf).
"""
import re, sys

VERSION = 'v12'

def bal(s, start):
    """Extrait un <div> équilibré depuis start."""
    depth = 0
    for m in re.finditer(r'<(/?)div[^>]*/?>', s[start:]):
        if m.group(0).endswith('/>'):
            continue
        if m.group(1):
            depth -= 1
            if depth == 0:
                return s[start:start + m.end()]
        else:
            depth += 1
    return None

def strip_wid(frag):
    return re.sub(r'\s*data-w-id="[^"]*"', '', frag)

def build(src_path, out_path):
    html = open(src_path, encoding='utf-8', errors='ignore').read()

    # ----- Hash CSS -----
    css = re.search(r'https://cdn\.prod\.website-files\.com/[^"]+\.css', html).group(0)

    # ----- Header -----
    header = bal(html, html.index('<div class="_3-cont-head'))
    header = header.replace('class="_3-menou-bouton-compte user w-inline-block"',
                            'class="_3-menou-bouton-compte user w-inline-block" id="btnCompte"')
    header = header.replace('class="link-menu-general w-inline-block"',
                            'class="link-menu-general w-inline-block" id="btnMenuGeneral"')
    header = re.sub(r'class="_3-menu-mon-compte"', 'class="_3-menu-mon-compte" id="menuCompte" style="display:none"', header)
    header = re.sub(r'class="_3-menu-general"', 'class="_3-menu-general" id="menuGeneral" style="display:none"', header)
    header = re.sub(r'<a[^>]*class="menu-link"[^>]*>\s*me connecter\s*</a>',
                    '<a href="#" class="menu-link" id="openConnect">me connecter</a>', header)
    header = re.sub(r'<a[^>]*class="menu-link"[^>]*>\s*info. personelles\s*</a>',
                    '<a href="#" class="menu-link" id="openInfosPerso">info. personelles</a>', header)
    header = re.sub(r'<a[^>]*class="menu-link"[^>]*>\s*mon activité\s*</a>',
                    '<a href="#" class="menu-link" id="openActivite">mon activité</a>', header)
    header = re.sub(r'<a[^>]*class="menu-link"[^>]*>\s*messagerie\s*</a>',
                    '<a href="#" class="menu-link menu-link-off">messagerie</a>'
                    '<a href="#" class="menu-link" id="btnLogoutMenu" style="display:none">me déconnecter</a>', header)
    header = re.sub(r'(<div class="bloclogo[^"]*"[^>]*>\s*)<a([^>]*)>', r'\1<a\2 data-section="0">', header)
    header = strip_wid(header)

    # ----- Menu 4 boutons -----
    mzone = html[html.index('<div class="_3-cont-page-menu'):]
    menu4 = bal(mzone, mzone.index('<div class="_3-menu'))
    for sec in (1, 2, 3, 4):
        menu4 = menu4.replace('href="#" class="_2-menu-bouton w-inline-block"',
                              f'href="#" data-section="{sec}" class="_2-menu-bouton w-inline-block"', 1)
    menu4 = strip_wid(menu4)

    # ----- Sections 0-4 -----
    sections = {}
    for n in range(5):
        i = html.index(f'_3-{n}_sous-menu-content-{n}')
        frag = bal(html, html.rindex('<div', 0, i))
        end = frag.index('>') + 1
        frag = (f'<div class="_3-{n}_sous-menu-content-{n}" id="section-{n}"'
                + ('' if n == 0 else ' style="display:none"') + '>' + frag[end:])
        sections[n] = strip_wid(frag)

    # Section 1 : hooks tri/filtre, contenu dynamique
    s1 = sections[1]
    s1 = s1.replace('class="_w-dropdown-copy w-dropdown-toggle"',
                    'class="_w-dropdown-copy w-dropdown-toggle" id="triGouvToggle"', 1)
    s1 = s1.replace('class="dropdown-list-4 w-dropdown-list"',
                    'class="dropdown-list-4 w-dropdown-list" id="triGouvList"', 1)
    tris = ['note', 'votes', 'popularite', 'date']
    c = [0]
    def tl(m):
        v = tris[c[0]] if c[0] < 4 else ''
        c[0] += 1
        return m.group(0).replace('href="#"', f'href="#" data-tri="{v}"')
    s1 = re.sub(r'<a href="#" class="_w-dropdown-left w-dropdown-link">', tl, s1)
    s1 = re.sub(r'(<strong class="heading-bold-text")(>[^<]*</strong>)', r'\1 id="triGouvLabel"\2', s1, 1)
    s1 = s1.replace('id="checkbox"', 'id="filtrePret"', 1)
    gc = bal(s1, s1.index('<div class="_3-gov-content"'))
    s1 = s1.replace(gc, '<div class="_3-gov-content" id="liste-gouvernements"></div>')
    while 'gov-compact-bloc' in s1:
        i = s1.index('gov-compact-bloc')
        s1 = s1.replace(bal(s1, s1.rindex('<div', 0, i)), '', 1)
    sections[1] = s1

    # Section 2 : squelette composer applicatif
    sections[2] = '''<div class="_3-2_sous-menu-content-2" id="section-2" style="display:none">
  <div class="content-gm-compo-gov">
    <div class="bloc-v-gap10">
      <input class="mon-input3 w-input" type="text" id="gouvTitre" placeholder="nom de votre gouvernement" maxlength="120"/>
      <textarea class="mon-input3 w-input" id="gouvDescription" placeholder="description (votre vision, vos intentions)" rows="3"></textarea>
    </div>
    <div class="bloc-title"><h2>Ministères Régaliens</h2></div>
    <div class="_3-bloc-minsteres" id="composer-postes"></div>
    <div class="pubis-utons">
      <div class="flex---gap-10">
        <a href="#" id="btnAddMinistere" class="_w-link-bloc-button add-ministere w-inline-block"><div>+ ajouter un ministère</div></a>
        <a href="#" id="btnAddDelegue" class="_w-link-bloc-button add-ministere w-inline-block"><div>+ ajouter un délégué</div></a>
      </div>
      <div class="flex---gap-10">
        <a href="#" id="btnBrouillon" class="_w-link-bloc-button bbrouillon w-inline-block"><div>brouillon</div></a>
        <a href="#" id="btnPublier" class="_w-link-bloc-button publier w-inline-block"><div>publier</div></a>
      </div>
    </div>
  </div>
</div>'''

    # Section 3 : hooks du formulaire
    s3 = sections[3]
    s3 = re.sub(r'(<input[^>]*placeholder="nom"[^>]*id=")[^"]*(")', r'\1addNom\2', s3)
    s3 = re.sub(r'(<input[^>]*placeholder="prénom"[^>]*id=")[^"]*(")', r'\1addPrenom\2', s3)
    if 'id="addMetier"' not in s3:
        s3 = re.sub(r'(<input[^>]*id="addPrenom"[^>]*/>)',
                    r'\1\n<input class="mon-input w-input" maxlength="256" placeholder="métier (facultatif)" type="text" id="addMetier"/>',
                    s3, 1)
    s3 = re.sub(r'(<a[^>]*href="#")([^>]*class="_w-link-bloc-button publier w-inline-block")',
                r'\1 id="btnAddPerso"\2', s3, 1)
    sections[3] = s3

    # Section 4 : filtres + grille dynamique
    s4 = sections[4]
    sels = list(re.finditer(r'<select[^>]*>.*?</select>', s4, re.S))
    if len(sels) >= 2:
        s4 = s4.replace(sels[0].group(0),
            '<select id="filtreStatut" class="_5-selecta mon-inputdrop w-select"><option value="">tous les statuts</option><option value="3">ok</option><option value="2">sous condition</option><option value="1">jamais</option><option value="0">néant</option></select>', 1)
        s4 = s4.replace(sels[1].group(0),
            '<select id="ordreListe" class="_5-selecta mon-inputdrop w-select"><option value="alpha">ordre alphabétique</option><option value="metier">par métier</option></select>', 1)
    gi = s4.index('<div class="_3-grid-perso"')
    prelude = s4[:gi]
    ouverts = prelude.count('<div') - prelude.count('</div')
    sections[4] = prelude + '<div id="liste-personnalites"></div>' + '</div>' * ouverts

    # ----- Modal connexion (repris de la maquette) -----
    pmz = html[html.index('<div class="petits-modaux'):]
    ci = pmz.index('pm-parent connect')
    pm_connect = bal(pmz, pmz.rindex('<div', 0, ci))
    pm_connect = re.sub(r'(class="pm-parent connect")', r'\1 id="modal-connect"', pm_connect)
    pm_connect = re.sub(r'<div data-w-id="[^"]*" style="display:none" class="pm-parent connect" id="modal-connect">',
                        '<div style="display:none" class="pm-parent connect" id="modal-connect">', pm_connect)
    ins = list(re.finditer(r'<input[^>]*mon-input5[^>]*/>', pm_connect))
    hooks = ['loginUsername', 'loginPassword', 'signupUsername', 'signupPassword', 'signupEmail']
    types = ['text', 'password', 'text', 'password', 'email']
    for idx, m in enumerate(ins[:5]):
        new = re.sub(r'id="[^"]*"', f'id="{hooks[idx]}"', m.group(0))
        new = re.sub(r'type="[^"]*"', f'type="{types[idx]}"', new)
        pm_connect = pm_connect.replace(m.group(0), new, 1)
    btns = list(re.finditer(r'<a href="#" class="_w-link-bloc-button publier w-inline-blo[^"]*"', pm_connect))
    if btns:
        pm_connect = pm_connect.replace(btns[0].group(0), btns[0].group(0).replace('href="#"', 'href="#" id="btnLogin"'), 1)
    if len(btns) > 1:
        pm_connect = pm_connect.replace(btns[1].group(0), btns[1].group(0).replace('href="#"', 'href="#" id="btnSignup"'), 1)
    pm_connect = pm_connect.replace('<div class="croix"></div>', '<div class="croix">&times;</div>')
    pm_connect = re.sub(r'<a[^>]*class="_3-close-bouton[^"]*"', '<a href="#" data-close-modal class="_3-close-bouton invert w-inline-block"', pm_connect)
    pm_connect = strip_wid(pm_connect)

    # ----- Modaux applicatifs (coquilles maquette) -----
    modaux = '''
<div class="bm-parent" id="modal-infos" style="display:none">
  <div class="cont-flex-50-50">
    <a href="#" class="_3-close-bouton invert w-inline-block" data-close-modal><div class="croix">&times;</div></a>
    <div class="_3-big-modal-stroke">
      <div class="esp-perso-content">
        <h1>Données personnelles</h1>
        <div class="_3-form-gap-10">
          <input class="mon-input5 w-input" type="text" id="infoNom" placeholder="nom"/>
          <input class="mon-input5 w-input" type="text" id="infoPrenom" placeholder="prénom"/>
          <input class="mon-input5 w-input" type="email" id="infoEmail" placeholder="email"/>
          <a href="#" id="btnSaveInfos" class="_w-link-bloc-button publier w-inline-block"><div>enregistrer</div></a>
        </div>
        <div class="div-activit" id="espace-perso">
          <h1>Mon activité</h1>
          <div class="esp-bloc"><h4>Personnalités likées</h4><div id="esp-likes" class="esp-liste"></div></div>
          <div class="esp-bloc"><h4>Personnalités épinglées</h4><div id="esp-epingles-perso" class="esp-liste"></div></div>
          <div class="esp-bloc"><h4>Gouvernements épinglés</h4><div id="esp-epingles-gouv" class="esp-liste"></div></div>
          <div class="esp-bloc"><h4>Mes brouillons</h4><div id="esp-brouillons" class="esp-liste"></div></div>
          <div class="esp-bloc"><h4>Mes votes</h4><div id="esp-votes" class="esp-liste"></div></div>
          <div class="esp-bloc"><h4>Mes commentaires</h4><div id="esp-commentaires" class="esp-liste"></div></div>
        </div>
      </div>
    </div>
  </div>
</div>
<div class="bm-parent" id="modal-detail" style="display:none">
  <div class="cont-flex-50-50">
    <a href="#" class="_3-close-bouton invert w-inline-block" data-close-modal><div class="croix">&times;</div></a>
    <div class="_3-big-modal-stroke"><div class="_4-content-gm" id="detail-contenu"></div></div>
  </div>
</div>
<div class="bm-parent" id="modal-fiche" style="display:none">
  <div class="cont-flex-50-50">
    <a href="#" class="_3-close-bouton invert w-inline-block" data-close-modal><div class="croix">&times;</div></a>
    <div class="_3-big-modal-stroke"><div class="_3-content-fiche-perso" id="fiche-contenu"></div></div>
  </div>
</div>
<div class="pm-parent" id="modal-admin-perso" style="display:none">
  <div class="cont-flex-50-50">
    <a href="#" class="_3-close-bouton invert w-inline-block" data-close-modal><div class="croix">&times;</div></a>
    <div class="_3-small-modal-stroke"><div class="_3-petit-modal-content">
      <h1>Modifier la personnalité</h1>
      <div class="_3-form-gap-10">
        <input class="mon-input5 w-input" type="text" id="admNom" placeholder="nom"/>
        <input class="mon-input5 w-input" type="text" id="admPrenom" placeholder="prénom"/>
        <input class="mon-input5 w-input" type="text" id="admMetiers" placeholder="métiers (séparés par des virgules)"/>
        <textarea class="mon-input5 w-input" id="admShortBio" placeholder="biographie courte" rows="2"></textarea>
        <textarea class="mon-input5 w-input" id="admBio" placeholder="biographie complète" rows="4"></textarea>
        <select id="admStatut" class="_5-selecta mon-inputdrop w-select">
          <option value="0">néant</option><option value="1">jamais</option>
          <option value="2">sous condition</option><option value="3">ok</option>
        </select>
        <div class="adm-liens-bloc">
          <h4>Documents en ligne (liens, vidéos)</h4>
          <div id="admLiensListe"></div>
          <div class="adm-liens-form">
            <select id="admLienType" class="_5-selecta mon-inputdrop w-select">
              <option value="lien">Lien internet</option><option value="video">Vidéo</option>
            </select>
            <input class="mon-input5 w-input" type="text" id="admLienTitre" placeholder="titre du document"/>
            <input class="mon-input5 w-input" type="text" id="admLienUrl" placeholder="URL (https://…)"/>
            <a href="#" id="admLienAddBtn" class="_w-link-bloc-button bbrouillon w-inline-block"><div>ajouter ce document</div></a>
          </div>
        </div>
        <a href="#" id="admSaveBtn" class="_w-link-bloc-button publier w-inline-block"><div>enregistrer</div></a>
      </div>
    </div></div>
  </div>
</div>
<div class="pm-parent" id="modal-sous-secteurs" style="display:none">
  <div class="cont-flex-50-50">
    <a href="#" class="_3-close-bouton invert w-inline-block" data-close-modal><div class="croix">&times;</div></a>
    <div class="_3-small-modal-stroke"><div class="_3-petit-modal-content">
      <h1>Sous-secteurs</h1>
      <div id="sous-secteurs-contenu"></div>
      <a href="#" id="btnCloseSous" class="_w-link-bloc-button publier w-inline-block"><div>valider</div></a>
    </div></div>
  </div>
</div>'''

    # ----- Footer -----
    foot = '''<div class="_3-cont-foot">
  <div class="admine-part" id="adminFooter" style="display:none">
    <a href="#" data-section="4" class="link-admin">page admin + personalité</a>
  </div>
  <a href="index_classique.html" class="version-switch">version classique</a>
</div>'''

    head = f'''<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <title>SOSGOUV, Imaginez votre gouvernement</title>
  <meta content="width=device-width, initial-scale=1" name="viewport"/>
  <!-- webflow-css-sync: la ligne suivante est mise à jour automatiquement -->
  <link href="{css}" rel="stylesheet" type="text/css"/>
  <link href="css/sosgouv.css?{VERSION}" rel="stylesheet" type="text/css"/>
  <script src="https://ajax.googleapis.com/ajax/libs/webfont/1.6.26/webfont.js" type="text/javascript"></script>
  <script type="text/javascript">
    if (window.WebFont) WebFont.load({{ google: {{ families: ["Lato:400,700,900"] }} }});
  </script>
  <script type="text/javascript">
    !function(o,c){{var n=c.documentElement,t=" w-mod-";n.className+=t+"js",("ontouchstart"in o||o.DocumentTouch&&c instanceof DocumentTouch)&&(n.className+=t+"touch")}}(window,document);
  </script>
</head>
<body>
<div class="grid-layout">
'''

    tail = f'''
</div>
<div class="_3-fond-modal" id="fondModal" style="display:none"></div>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="config.js?{VERSION}"></script>
<script src="js/auth.js?{VERSION}"></script>
<script src="js/ui.js?{VERSION}"></script>
<script src="js/personnalites.js?{VERSION}"></script>
<script src="js/gouvernement.js?{VERSION}"></script>
</body>
</html>'''

    body = (head + header + '\n<div class="_3-cont-body">\n'
            + pm_connect + modaux
            + '\n<div class="_3-cont-page-menu"><div class="_3-menu-wrap">' + menu4 + '</div>\n'
            + '\n'.join(sections[n] for n in range(5))
            + '\n</div>\n' + foot + '\n</div>' + tail)

    open(out_path, 'w').write(body)
    delta = body.count('<div') - body.count('</div')
    print(f'{out_path} : {len(body)} caractères, delta div = {delta}, css = {css.split("/")[-1]}')
    return delta == 0

if __name__ == '__main__':
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else 'index.html'
    ok = build(src, out)
    sys.exit(0 if ok else 1)
