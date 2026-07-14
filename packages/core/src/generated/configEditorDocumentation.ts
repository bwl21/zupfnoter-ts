/** Generated from docs/user-manual/UD_Zupfnoter-Handbuch/help_de-de.md. */
export interface ConfigEditorOptionDocumentation {
  label: string
  description: string
}

export const CONFIG_EDITOR_OPTION_DOCUMENTATION: Readonly<Record<string, Readonly<Record<string, ConfigEditorOptionDocumentation>>>> = {
  "align": {
    "l": {
      "label": "Links",
      "description": "der Text steht links vom Bezugspunkt (und ist daher rechtsbündig)"
    },
    "r": {
      "label": "Rechts",
      "description": "der Text steht rechts vom Bezugspunkt (und ist daher linksbündig)"
    },
    "auto": {
      "label": "Automatisch",
      "description": "die Ausrichtung wird automatisch errechnet"
    }
  },
  "extract.0.legend": {
    "pos": {
      "label": "pos",
      "description": "Position des Titels des Musikstückes"
    },
    "spos": {
      "label": "spos",
      "description": "Position der Sublegende, d.h. der weiteren Angaben zum Musikstück"
    }
  },
  "extract.0.legend.align": {
    "l": {
      "label": "Links",
      "description": "der Text steht links vom Bezugspunkt (und ist daher rechtsbündig)"
    },
    "r": {
      "label": "Rechts",
      "description": "der Text steht rechts vom Bezugspunkt (und ist daher linksbündig)"
    },
    "auto": {
      "label": "Wie links",
      "description": "wie `l`"
    }
  },
  "barnumbers.apanchor": {
    "center": {
      "label": "center",
      "description": "die Taktnummer wird an der Mitte der Note verankert"
    },
    "box": {
      "label": "box",
      "description": "die Taktnummer wird am unteren Rand der Note verankert"
    }
  },
  "countnotes.apanchor": {
    "center": {
      "label": "center",
      "description": "die Zählmarke wird an der Mitte der Note verankert"
    },
    "box": {
      "label": "box",
      "description": "die Zählmarke wird am unteren Rand der Note verankert"
    }
  },
  "apanchor": {
    "center": {
      "label": "center",
      "description": "das Objekt wird an der Mitte der Note verankert"
    },
    "box": {
      "label": "box",
      "description": "das Objekt wird am unteren Rand der Note verankert"
    }
  },
  "countnotes.cntextleft": {
    "{countnote}": {
      "label": "{countnote}",
      "description": ""
    },
    "{lyrics}": {
      "label": "{lyrics}",
      "description": ""
    }
  },
  "countnotes.cntextright": {
    "{countnote}": {
      "label": "{countnote}",
      "description": ""
    },
    "{lyrics}": {
      "label": "{lyrics}",
      "description": ""
    }
  },
  "instrument": {
    "37-strings-g-g": {
      "label": "37-saitige Harfe",
      "description": ""
    },
    "25-strings-g-g": {
      "label": "25-saitige Harfe",
      "description": ""
    },
    "21-strings-a-f": {
      "label": "21-saitige Harfe",
      "description": ""
    },
    "18-strings-b-e": {
      "label": "18-saitige Harfe",
      "description": ": gestimmt von B bis e"
    },
    "saitenspiel": {
      "label": "saitenspiel",
      "description": "das ist ein diatonisch gestimmtes Saitenspiel mit einer G-Bass-Saite"
    },
    "Zipino": {
      "label": "Zipino",
      "description": "das ist ein diatonisch gestimmtes Saitenspiel mit einer G-Bass-Saite"
    },
    "okon-*": {
      "label": "Okon-Tischharfe",
      "description": ": Tischharfe von okon-guitar.de. Dieses Instrument hat Klappen für die Anpassung der Tonart. Daher gibt es hier veschiedene varianten"
    },
    "akkordzither": {
      "label": "Akkordzither",
      "description": ": Für die Akkordzither gibt es verschiedene Varianten und Stimmungen. Bitte experimentieren Sie mit den Saitennamen."
    },
    "klein-a4": {
      "label": "klein-a4",
      "description": "ein Instrument bei dem die Unterlegnonten auf ein A4-Blatt passen."
    }
  },
  "instrument\\_shape": {
    "['M', x, y]": {
      "label": "['M', x, y]",
      "description": "Bewege den Schreibpunkt zu x, y"
    },
    "['L', x, y]": {
      "label": "['L', x, y]",
      "description": "Zeichne eine Linie nach x,y"
    },
    "['l', x, y]": {
      "label": "['l', x, y]",
      "description": "zeichne **weiter** um x, y"
    },
    "['c', x, y, c1x, c1y, c2x, c2y ]": {
      "label": "['c', x, y, c1x, c1y, c2x, c2y ]",
      "description": "zeichne weiter mit einer Bezièrs-Kurve"
    },
    "['z]": {
      "label": "['z]",
      "description": "schliesse die Kurve"
    }
  },
  "layout.color": {
    "black": {
      "label": "Schwarz",
      "description": ""
    },
    "grey": {
      "label": "Grau",
      "description": ""
    },
    "darkgrey": {
      "label": "Dunkelgrau",
      "description": ""
    },
    "dimgrey": {
      "label": "Gedämpftes Grau",
      "description": ""
    }
  },
  "minc\\_f": {
    "0": {
      "label": "0",
      "description": "ändert nichts am Vorschub. Damit kann man den Wert zurücksetzen, falls er im Auszug 0 gesetzt wurde."
    },
    "-1.0": {
      "label": "-1.0",
      "description": "würde den Vorschub um eine ganze Note zurück setzen"
    },
    "0.5": {
      "label": "0.5",
      "description": "vergrößert den Vorschub um die Hälfte einer ganzen Note."
    }
  },
  "nshift": {
    "+1.0": {
      "label": "+1.0",
      "description": "verschiebt die Note um eine Notenbreite nach rechts"
    },
    "-1.0": {
      "label": "-1.0",
      "description": "verschiebt die Note um eine Notenbreite nach links"
    }
  },
  "notes.T01\\_number\\_extract": {
    "-A": {
      "label": "-A",
      "description": "Sopran Alt - per default Auszug 1"
    },
    "-B": {
      "label": "-B",
      "description": "Tenor Bass - per default Auszug 2"
    },
    "-M": {
      "label": "-M",
      "description": "Nur Melodie - am besten Auszug 3 - ist aber nicht per default konfiguriert"
    },
    "-S": {
      "label": "-S",
      "description": "Alle Stimmen - per default Auszug 0; dieser wird in der Regel aber nicht gedruckt, sondern nur zur Bearbeitung verwendet."
    }
  },
  "restposition": {
    "center": {
      "label": "Mitte",
      "description": "positioniert die Pause zwischen die vorherige und die nächste Note"
    },
    "next": {
      "label": "Nächste Note",
      "description": "positioniert die Pause auf die gleiche Tonhöhe wie die nächste Note"
    },
    "previous": {
      "label": "Vorherige Note",
      "description": "positioniert die Pause auf die gleiche Tonhöhe wie die vorherige Note"
    },
    "default": {
      "label": "Vorgabewert",
      "description": "übernimmt den Vorgabewert"
    }
  },
  "stringnames.text": {
    "+ -": {
      "label": "+ -",
      "description": "erzeugt `+ - +  + - + -`"
    },
    "C Cis D Dis E F Fis G Gis A Aia Bb B": {
      "label": "C Cis D Dis E F Fis G Gis A Aia Bb B",
      "description": "erzeugt die regulären Saitennamen"
    }
  },
  "tuning": {
    "fixed": {
      "label": "feste stimmung",
      "description": "Mit dieser Einstellung ist die Stimmung des Instrumentes fest vorgegegeben."
    },
    "open": {
      "label": "offene Stimmung",
      "description": "Wenn der Parameter `tuning` auf den Wert `offen` gesetzt ist, wird die Stimmung der Saiten aus den Saitennamen abgeleitet."
    },
    "C,": {
      "label": "C,",
      "description": "`C` `c` `c'` spannt vier Oktaven auf"
    },
    "C *C C-s- CIS": {
      "label": "C *C C-s- CIS",
      "description": ""
    },
    "D *D D-s- DIS DES DB": {
      "label": "D *D D-s- DIS DES DB",
      "description": ""
    },
    "E EB ES": {
      "label": "E EB ES",
      "description": ""
    },
    "F  *F F-s- FIS": {
      "label": "F  *F F-s- FIS",
      "description": ""
    },
    "G *G G-s- GIS GES GB": {
      "label": "G *G G-s- GIS GES GB",
      "description": ""
    },
    "A *A A-s-  AIS AS AB": {
      "label": "A *A A-s-  AIS AS AB",
      "description": ""
    },
    "H B HB BB *HB *BB": {
      "label": "H B HB BB *HB *BB",
      "description": ""
    }
  },
  "shape": {
    "c": {
      "label": "c",
      "description": "Kurve"
    },
    "l": {
      "label": "l",
      "description": "Linie"
    }
  },
  "text": {
    "{{composer}}": {
      "label": "{{composer}}",
      "description": "Komponist aus `C:` Zeilen"
    },
    "{{current_year}}": {
      "label": "{{current_year}}",
      "description": "das aktuelle Jahr"
    },
    "{{key}}": {
      "label": "{{key}}",
      "description": "Tonart aus `K:` Zeile"
    },
    "{{meter}}": {
      "label": "{{meter}}",
      "description": "Taktart aus `M:` Zeile"
    },
    "{{number}}": {
      "label": "{{number}}",
      "description": "Nummer aus `X:` Zeile"
    },
    "{{o_key}}": {
      "label": "{{o_key}}",
      "description": "Originaltonart"
    },
    "{{tempo}}": {
      "label": "{{tempo}}",
      "description": "Tempo aus `Q:`Zeile"
    },
    "{{title}}": {
      "label": "{{title}}",
      "description": "Titel aus `T:` Zeilen"
    },
    "{{extract_title}}": {
      "label": "{{extract_title}}",
      "description": "titel des auszgs aus \"extract.\\*.title\","
    },
    "{{extract_filename}}": {
      "label": "{{extract_filename}}",
      "description": "Filenamenszusatz aus \"extract.\\*.filenamepart\"},"
    },
    "{{printed_extracts}}": {
      "label": "{{printed_extracts}}",
      "description": "erstellte Auszüge aus \"produce\". Es werden die entsprechneden Filenamenzusätze ausgegeben."
    },
    "{{watermark}}": {
      "label": "{{watermark}}",
      "description": "Wasserzeichen (mit `setsettings wartermark \"wasserzeichen\"` eingestellt)"
    }
  }
} as const
