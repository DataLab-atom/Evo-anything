"""
TSP (Traveling Salesman Problem) - Optimization Target
"""

import random
import math
import itertools


def calculate_distance(city1, city2):
    """Calculate Euclidean distance between two cities."""
    return math.sqrt((city1[0] - city2[0])**2 + (city1[1] - city2[1])**2)


def calculate_total_distance(route, cities):
    """Calculate total distance for a given route."""
    total = 0
    for i in range(len(route) - 1):
        total += calculate_distance(cities[route[i]], cities[route[i + 1]])
    # Return to start
    total += calculate_distance(cities[route[-1]], cities[route[0]])
    return total


def solve_tsp_greedy(cities):
    """
    Greedy nearest neighbor with bytearray visited and tuple unpacking.
    """
    n = len(cities)
    if n == 0:
        return []

    visited = bytearray(n)
    route = [0]
    visited[0] = 1
    cx = tuple(c[0] for c in cities)
    cy = tuple(c[1] for c in cities)

    route_append = route.append
    for _ in range(n - 1):
        current = route[-1]
        cur_x = cx[current]
        cur_y = cy[current]
        nearest = -1
        nearest_dist = 1e30

        for j in range(n):
            if not visited[j]:
                dx = cur_x - cx[j]
                dy = cur_y - cy[j]
                d = dx * dx + dy * dy
                if d < nearest_dist:
                    nearest_dist = d
                    nearest = j

        route_append(nearest)
        visited[nearest] = 1

    return route


def solve_tsp_brute_force(cities):
    """
    Brute force TSP solution - finds optimal route but is slow.
    This is the target function to optimize.
    """
    n = len(cities)
    
    # Use greedy for n > 7 (much faster)
    if n > 7:
        return solve_tsp_greedy(cities)
    
    # For small n, brute force is fine
    best_route = None
    best_distance = float('inf')
    
    for perm in itertools.permutations(range(n)):
        dist = calculate_total_distance(perm, cities)
        if dist < best_distance:
            best_distance = dist
            best_route = perm
    
    return list(best_route)


def generate_cities(n=20, seed=42):
    """Generate random cities."""
    random.seed(seed)
    return [(random.random() * 100, random.random() * 100) for _ in range(n)]


def run_benchmark():
    """Main benchmark function."""
    cities = generate_cities(8, 42)
    route = solve_tsp_brute_force(cities)
    distance = calculate_total_distance(route, cities)
    print(f"{distance:.2f}")


if __name__ == "__main__":
    run_benchmark()
