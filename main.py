import flet as ft
import os
from supabase import create_client, Client
from datetime import datetime

static_path = os.path.abspath("static/logos")

URL: str = "https://fvshlyupvxqpsocgewnn.supabase.co"
KEY: str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2c2hseXVwdnhxcHNvY2dld25uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1MzQ0OTEsImV4cCI6MjA1NjExMDQ5MX0.VTCL_FymD-WV6NL4Gb-f2zXT5W9GYTOZwLG7ffaulHM"

supabase: Client = create_client(URL, KEY)

def get_games():
    """Obtiene los juegos desde Supabase ordenados por fecha de creación (más recientes primero)."""
    try:
        response = supabase.table("games").select("*").order("created_at", desc=True).execute()

        if not response.data:
            print("No se encontraron juegos.")
            return []
        
        return response.data
    except Exception as e:
        print("Error al obtener juegos:", e)
        return []

def add_game(team_local, team_away, game_date, game_time, week, year):
    """Agrega un juego a Supabase con fecha, hora, semana y año"""
    try:
        response = supabase.table("games").insert({
            "team_local": team_local,
            "team_away": team_away,
            "date": game_date,
            "time": game_time,
            "week": week,
            "year": year
        }).execute()

        if response.data:  # Verificamos si la inserción fue exitosa
            print("Juego agregado con éxito")
            return True
        else:
            print("Error al agregar el juego")
            return False

    except Exception as e:
        print("Error al agregar el juego:", e)
        return False


def main(page: ft.Page):
    page.title = "Game List"
    #page.vertical_alignment = ft.MainAxisAlignment.CENTER  # Centrar verticalmente
    page.add(
            ft.Row(
                controls=[
                    ft.Text("Games", size=24, weight=ft.FontWeight.BOLD, color=ft.Colors.BLUE_500)
                ],
                alignment=ft.MainAxisAlignment.CENTER,  # Centrado horizontalmente
            ),
        )
    
    # Almacenará la fecha seleccionada
    input_game_date = ft.TextField(label="Fecha del Juego", width=150, read_only=True)
    input_game_time = ft.TextField(label="Hora del Juego", width=150, read_only=True)


    def date_handle_change(e):
        """Actualizar el campo input_game_date con la fecha seleccionada."""
        input_game_date.value = e.control.value.strftime('%Y-%m-%d')
        page.update()  # Actualizar la página para reflejar el cambio

    def time_handle_change(e):
        selected_time = e.control.value
        input_game_time.value = selected_time.strftime('%H:%M:%S')
        page.update()


    logo_width = 45
    logo_height = 45
    text_size = 16
    input_width = 150

    # Inputs para agregar nuevos juegos
    input_team_local = ft.TextField(label="Equipo Local", width=input_width)
    input_team_away = ft.TextField(label="Equipo Visitante", width=input_width )

    btn_game_date = ft.ElevatedButton(
                        "Pick date",
                        icon=ft.Icons.CALENDAR_MONTH,
                        on_click=lambda e: page.open(
                            ft.DatePicker(
                                on_change=date_handle_change,
                            )
                        ),
                    )

    btn_game_time = ft.ElevatedButton(
                        "Pick time",
                        icon=ft.Icons.TIME_TO_LEAVE,
                        on_click=lambda e: page.open(
                            ft.TimePicker(
                                confirm_text="Confirm",
                                error_invalid_text="Time out of range",
                                help_text="Pick your time slot",
                                on_change=time_handle_change,
                            )
                        ),
                    )
    

    input_week = ft.TextField(label="Semana del Juego", width=input_width)
    input_year = ft.TextField(label="Año de la Liga", width=input_width)   

    # Lista de juegos
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

    # Función para agregar un juego
    def agregar_juego(e):
        """Agrega un juego a la base de datos y actualiza la lista"""
        team_local = input_team_local.value
        team_away = input_team_away.value
        game_date = input_game_date.value if input_game_date.value else None
        game_time = input_game_time.value if input_game_time.value else None
        week = input_week.value
        year = input_year.value

        if team_local and team_away and game_date and game_time and week and year:
            success = add_game(team_local, team_away, game_date, game_time, week, year)
            if success:
                print("Juego agregado con éxito")
                actualizar_lista(None)  # 🔹 Se actualiza la lista después de agregar el juego
            else:
                page.add(ft.Text("Error al agregar el juego", size=16, color=ft.Colors.RED))
                page.update()
        else:
            page.add(ft.Text("Por favor complete todos los campos", size=16, color=ft.Colors.RED))
            page.update()

    # Botón para agregar un juego
    
    boton_agregar = ft.ElevatedButton("Agregar Juego", on_click=agregar_juego)

    # Inicializar la lista con datos actuales
    actualizar_lista(None)

    # Organizar los inputs en dos columnas
    inputs_row = ft.Row(
        controls=[
            ft.Column(
                controls=[
                    input_team_local,
                    btn_game_date,
                    input_game_date,
                    input_week,
                ],
                spacing=5,
            ),
            ft.Column(
                controls=[
                    input_team_away,
                    btn_game_time,
                    input_game_time,
                    input_year,
                ],
                spacing=5,
            ),
        ],
        alignment=ft.MainAxisAlignment.START,
        spacing=30,
    )

    # Agregar los elementos a la página
    page.add(
        ft.Row([inputs_row], alignment=ft.MainAxisAlignment.CENTER),
        ft.Row([boton_agregar], alignment=ft.MainAxisAlignment.CENTER),  # Centrado botón Agregar
        list_games,
        ft.Row([boton_actualizar], alignment=ft.MainAxisAlignment.CENTER)  
    )  # Agregar la lista y el botón a la página

ft.app(target=main, host="0.0.0.0", port=8000)
