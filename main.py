import flet as ft
import os
from supabase import create_client, Client

static_path = os.path.abspath("static/logos")

URL: str = "https://fvshlyupvxqpsocgewnn.supabase.co"
KEY: str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2c2hseXVwdnhxcHNvY2dld25uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1MzQ0OTEsImV4cCI6MjA1NjExMDQ5MX0.VTCL_FymD-WV6NL4Gb-f2zXT5W9GYTOZwLG7ffaulHM"

supabase: Client = create_client(URL, KEY)

def get_games():
    """Obtiene los juegos desde Supabase"""
    try:
        response = supabase.table("games").select("*").execute()
        return response.data or []
    except Exception as e:
        print("Error al obtener juegos:", e)
        return []

def main(page: ft.Page):
    page.title = "Game List"
    page.vertical_alignment = ft.MainAxisAlignment.CENTER  # Centrar verticalmente

    logo_width = 45
    logo_height = 45
    text_size = 16
    #page.add(ft.Text("Lista de Juegos", size=20, weight=ft.FontWeight.BOLD, text_align=ft.TextAlign.CENTER))

    list_games = ft.Column(
        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
        spacing=10  # Espacio entre los elementos
    )

    def actualizar_lista(e):
        """Actualiza la lista de juegos al hacer clic en el botón"""
        list_games.controls.clear()  # Limpiar la lista antes de actualizar
        games = get_games()

        if games:
            for game in games:
                team_local_logo = f"{URL}/storage/v1/object/public/logos/{game.get('team_local', '')}.png"
                team_away_logo = f"{URL}/storage/v1/object/public/logos/{game.get('team_away', '')}.png"

                game_text = ft.Row(
                    controls=[
                        ft.Image(src=team_local_logo, width=logo_width, height=logo_height),
                        ft.Text(f"{game['team_local']}", size=text_size),
                        ft.Text("vs", size=14, weight=ft.FontWeight.BOLD),
                        ft.Text(f"{game['team_away']}", size=text_size),
                        ft.Image(src=team_away_logo, width=logo_width, height=logo_height),
                    ],
                    alignment=ft.MainAxisAlignment.CENTER
                )
                list_games.controls.append(game_text)
        else:
            list_games.controls.append(ft.Text("No hay juegos disponibles.", size=16, text_align=ft.TextAlign.CENTER))

        page.update()  # Actualizar la página con los nuevos datos

    # Botón para actualizar la lista de juegos
    boton_actualizar = ft.ElevatedButton("Actualizar Juegos", on_click=actualizar_lista)

    # Inicializar la lista con datos actuales
    actualizar_lista(None)

    page.add(list_games, boton_actualizar)  # Agregar la lista y el botón a la página

ft.app(target=main, host="0.0.0.0", port=8000) 